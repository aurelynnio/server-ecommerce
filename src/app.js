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
app.use(
  cors({
    // origin:
    //   process.env.FRONTEND_URL ||
    //   "https://client-ecommerce-git-main-cyhink4s-projects.vercel.app",
    // credentials: true,
    // allowedHeaders: ["Authorization", "Content-Type"],
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
