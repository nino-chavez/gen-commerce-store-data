import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from '../logger.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const log = createLogger('shipping');

function loadFixture(name) {
  const path = resolve(__dirname, '..', 'fixtures', name);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

async function cleanExistingZones(client, zoneNames) {
  log.info('Checking for existing test zones to clean up...');
  const zones = await client.get('shipping/zones');

  for (const zone of zones) {
    if (zoneNames.includes(zone.name)) {
      await client.del(`shipping/zones/${zone.id}`);
      log.dim(`  Deleted: "${zone.name}" (id: ${zone.id})`);
    }
  }
}

async function createZone(client, zoneDef) {
  // Create zone
  const zone = await client.post('shipping/zones', {
    name: zoneDef.name,
    order: zoneDef.order,
  });
  log.info(`Creating zone: "${zoneDef.name}" (id: ${zone.id})`);

  // Set locations
  if (zoneDef.locations?.length > 0) {
    await client.put(`shipping/zones/${zone.id}/locations`, zoneDef.locations);
    log.dim(`  Locations: ${zoneDef.locations.map((l) => `${l.type}:${l.code}`).join(', ')}`);
  }

  // Add and configure methods
  let methodCount = 0;
  for (const methodDef of zoneDef.methods) {
    // Skip carrier methods — they can't be created via REST API without the plugin.
    // Log them as skipped for visibility.
    if (methodDef.carrier) {
      log.warn(`  Skipped carrier method: ${methodDef.method_id} "${methodDef.title}" (plugin not installed)`);
      continue;
    }

    const method = await client.post(`shipping/zones/${zone.id}/methods`, {
      method_id: methodDef.method_id,
    });

    // Update method settings
    if (methodDef.settings) {
      const updatePayload = { settings: methodDef.settings };

      // Handle enabled/disabled
      if (methodDef.enabled === false) {
        updatePayload.enabled = false;
      }

      await client.put(`shipping/zones/${zone.id}/methods/${method.instance_id}`, updatePayload);
    } else if (methodDef.enabled === false) {
      await client.put(`shipping/zones/${zone.id}/methods/${method.instance_id}`, { enabled: false });
    }

    const status = methodDef.enabled === false ? 'DISABLED' : 'enabled';
    const cost = methodDef.settings?.cost || methodDef.settings?.min_amount || '';
    log.dim(`  Method: ${methodDef.method_id} ${cost ? `@ ${cost}` : ''} [${status}]`);
    methodCount++;
  }

  return { name: zoneDef.name, id: zone.id, methods: methodCount };
}

export async function seedShipping(client, opts = {}) {
  const negative = opts.negative || false;
  const fixture = negative ? loadFixture('shipping-zones-negative.json') : loadFixture('shipping-zones.json');
  const label = negative ? 'negative/edge-case' : 'positive';

  log.banner(`Seeding ${label} shipping zones (${fixture.zones.length} zones)`);

  // Test connection
  log.info('Testing connection...');
  const existingZones = await client.get('shipping/zones');
  log.info(`Connected. Found ${existingZones.length} existing zone(s).`);

  // Clean up
  const zoneNames = fixture.zones.map((z) => z.name);
  await cleanExistingZones(client, zoneNames);

  // Create zones
  const results = [];
  for (const zoneDef of fixture.zones) {
    try {
      const result = await createZone(client, zoneDef);
      results.push({ ...result, status: 'success' });
      if (zoneDef.expected) {
        log.dim(`  Expected: ${zoneDef.expected}`);
      }
    } catch (err) {
      results.push({ name: zoneDef.name, status: 'failed', error: err.message });
      log.error(`  Failed: ${err.message}`);
    }
  }

  // Handle Zone 0 for negative fixtures
  if (negative && fixture.zone_0_methods) {
    log.info('\nConfiguring Zone 0: "Rest of the World"');
    try {
      // Get existing Zone 0 methods and remove them
      const z0Methods = await client.get('shipping/zones/0/methods');
      for (const m of z0Methods) {
        await client.del(`shipping/zones/0/methods/${m.instance_id}`);
        log.dim(`  Removed existing: ${m.method_id} (instance: ${m.instance_id})`);
      }

      // Add new methods
      for (const methodDef of fixture.zone_0_methods) {
        const method = await client.post('shipping/zones/0/methods', {
          method_id: methodDef.method_id,
        });
        if (methodDef.settings) {
          await client.put(`shipping/zones/0/methods/${method.instance_id}`, {
            settings: methodDef.settings,
          });
        }
        log.dim(`  Method: ${methodDef.method_id} @ ${methodDef.settings?.cost || ''}`);
      }

      results.push({ name: 'Zone 0: Rest of the World', id: 0, methods: fixture.zone_0_methods.length, status: 'success' });
    } catch (err) {
      results.push({ name: 'Zone 0', status: 'failed', error: err.message });
      log.error(`Zone 0 failed: ${err.message}`);
    }
  }

  // Summary
  log.banner('SHIPPING SEED RESULTS');
  const succeeded = results.filter((r) => r.status === 'success');
  const failed = results.filter((r) => r.status === 'failed');

  for (const r of results) {
    const icon = r.status === 'success' ? 'OK' : 'FAIL';
    const detail = r.status === 'success' ? `id: ${r.id}, ${r.methods} methods` : r.error;
    log.info(`  ${icon} ${r.name} -- ${detail}`);
  }

  log.info(`\nTotal: ${succeeded.length} succeeded, ${failed.length} failed`);
  return { created: succeeded.length, failed: failed.length };
}
