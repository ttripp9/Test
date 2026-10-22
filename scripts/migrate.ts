import { openDatabase } from "../src/lib/db";
import { env } from "../src/lib/env";

openDatabase(env.databasePath);
console.log(`Database ready at ${env.databasePath}`);
