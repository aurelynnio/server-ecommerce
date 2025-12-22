const { server } = require("./app");
const connectDB = require("./db/connect.db");
const dotenv = require("dotenv");
dotenv.config();
const cluster = require("cluster");
const { initSocket } = require("./socket");

const PORT = process.env.PORT || 3000;

initSocket(server);

const { connectRabbitMQ } = require("./configs/rabbitmq.config");
const redis = require("./configs/redis.config");

const startServer = async () => {
  try {
    await connectDB();
    console.log("Database connected successfully");

    await connectRabbitMQ();

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

if (cluster.isPrimary) {
  const numWorkers = require("os").cpus().length;
  console.log(
    `Primary ${process.pid} is running. Forking ${numWorkers} workers...`
  );

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Forking a new worker...`);
    cluster.fork();
  });
} else {
  startServer();
}
