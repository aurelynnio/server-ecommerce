const { server } = require("./app");
const connectDB = require("./db/connect.db");
const dotenv = require("dotenv");
dotenv.config();
const cluster = require("cluster");
const { initSocket } = require("./socket");

const PORT = process.env.PORT || 3000;

initSocket(server);

const startServer = () => {
  connectDB()
    .then(() => {
      console.log("Database connected successfully");
    })
    .catch((error) => {
      console.error("Failed to connect to the database:", error);
    });

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

if (cluster.isPrimary) {
  const numWorkers = require('os').cpus().length;
  console.log(`Primary ${process.pid} is running. Forking ${numWorkers} workers...`);

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Forking a new worker...`);
    cluster.fork();
  });
} else {
  startServer();
}
