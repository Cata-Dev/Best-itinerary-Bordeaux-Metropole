import { app, gracefulStop } from "./base";
import initComputeJob from "./jobs/compute";

void (async () => {
  await app.agenda.ready;

  await initComputeJob(app);

  app.agenda.on("start", (job) => {
    console.log(`Job ${job.attrs.name} starting`);
  });
  app.agenda.on("complete", (job) => {
    console.log(`Job ${job.attrs.name} finished`);
  });
  app.agenda.on("fail", (err, job) => {
    console.log(`Job ${job.attrs.name} failed`, err);
  });
  await app.agenda.start();
})();

process.on("SIGTERM", gracefulStop);
process.on("SIGINT", gracefulStop);
