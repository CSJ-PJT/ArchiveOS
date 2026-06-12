import "dotenv/config";
import { runDemoArchitectureReview } from "./index.js";

const result = await runDemoArchitectureReview();
console.log(JSON.stringify(result, null, 2));
