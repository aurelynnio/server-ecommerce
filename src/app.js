const ex = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const initRoutes = require("./routes");
const http = require("http");
const { errorHandler, notFoundHandler } = require("./middlewares/errorHandler.middleware");
const corsMiddleware = require("./middlewares/cors.middleware");
const { globalLimiter } = require("./middlewares/rateLimited.middleware");
const app = ex();

const server = http.createServer(app);

// Middlewares
app.use(morgan("dev"));
app.use(corsMiddleware);
app.use(globalLimiter);
app.use(ex.json());
app.use(ex.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet());


initRoutes(app);

app.get("/", (req, res) => {
  res.status(200).json({ status: "API OK" });
});

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler - must be last middleware
app.use(errorHandler);

module.exports = {
  server,
  app,
};
