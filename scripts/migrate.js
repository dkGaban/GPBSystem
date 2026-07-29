require("dotenv").config();

const { runMigrations } = require("../db");

runMigrations()
  .then(([batch, migrations]) => {
    console.log(`Applied migration batch ${batch}: ${migrations.length} migration(s).`);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  });
