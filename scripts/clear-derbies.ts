import { closeDb, getDb, umzug } from "../src/db";

type CountRow = {
  count: number;
};

const getEventCount = () => {
  const db = getDb();
  const row = db.query("SELECT COUNT(*) as count FROM events").get() as CountRow | undefined;
  return row?.count ?? 0;
};

const main = async () => {
  try {
    await umzug.up();

    const beforeCount = getEventCount();

    if (beforeCount === 0) {
      console.log("No derbies found. Nothing to clear.");
      return;
    }

    const db = getDb();
    db.run("DELETE FROM events");

    const afterCount = getEventCount();
    const deletedCount = beforeCount - afterCount;

    console.log(`Cleared ${deletedCount} derby event(s).`);
  } catch (error) {
    console.error("Failed to clear derbies:", error);
    process.exit(1);
  } finally {
    closeDb();
  }
};

await main();
