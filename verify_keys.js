const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_MaXfbS69cdJG@ep-plain-band-ahs1318k-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function verify() {
    const client = new Client({
        connectionString: DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('Connected to database');

        const res = await client.query(`
            SELECT d.id, d.name, d.device_key, d.status, d.last_seen, d.user_id, u.email 
            FROM devices d
            LEFT JOIN users u ON d.user_id = u.id
        `);
        console.log('--- REGISTERED DEVICES ---');
        console.table(res.rows);

        const hardcodedKey = '00d6644c-3785-4a2d-ae71-1ec6c81b1a9a';
        const found = res.rows.find(d => d.device_key === hardcodedKey);
        if (found) {
            console.log(`\n✅ Hardcoded key "${hardcodedKey}" FOUND in database.`);
            console.log(`Owner: id=${found.user_id}, email=${found.email}`);
        } else {
            console.log(`\n❌ Hardcoded key "${hardcodedKey}" NOT FOUND in database.`);
        }

    } catch (err) {
        console.error('Error connecting to database:', err.stack);
    } finally {
        await client.end();
    }
}

verify();
