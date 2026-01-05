const ex = require("express");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const initRoutes = require("./routes");
const http = require("http");
const app = ex();
const server = http.createServer(app);

// Middlewares
app.use(morgan("dev"));

// CORS Configuration
const allowedOrigins = process.env.NODE_ENV === "production"
  ? [process.env.FRONTEND_URL]
  : ["http://localhost:3000", "http://localhost:3001", "https://etiso.me"];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"],
  })
);
app.use(ex.json());
app.use(ex.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet());

initRoutes(app);

app.get("/", (req, res) => {
  res.status(200).json({ status: "API OK" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ status: "Internal Server Error", message: err.message });
});

module.exports = {
  server,
  app,
};
