const mysql = require('mysql2/promise');

async function revert() {
  const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'pooji@1224',
    database: 'helpdesk_lite',
    port: 3306,
  });
  try {
    // 1. Restore all 'Technical & Software' tickets back to 'Technical'
    //    (original DB only ever had 'Technical' — Software was never used)
    const [t] = await db.query(
      "UPDATE tickets SET category = 'Technical' WHERE category = 'Technical & Software'"
    );
    console.log(`✓ Restored ${t.affectedRows} ticket(s) → category 'Technical'`);

    // 2. Drop the category column from users (added by migration)
    const [cols] = await db.query("SHOW COLUMNS FROM users LIKE 'category'");
    if (cols.length > 0) {
      await db.query('ALTER TABLE users DROP COLUMN category');
      console.log('✓ Dropped category column from users table');
    } else {
      console.log('- category column not found, nothing to drop');
    }

    // 3. Verify final state
    const [cats]  = await db.query('SELECT DISTINCT category FROM tickets ORDER BY category');
    const [ucols] = await db.query('SHOW COLUMNS FROM users');
    console.log('Ticket categories now:', cats.map(r => r.category));
    console.log('Users columns now:', ucols.map(r => r.Field));
  } catch (e) {
    console.error('Revert error:', e.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}
revert();
