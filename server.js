require("dotenv").config();
let express = require("express");
let bodyParser = require("body-parser");
let path = require("path");
let drinks = require("./public/drinks");
let mongoose = require("mongoose");

let bcrypt = require("bcryptjs");

let jwt = require("jsonwebtoken");
let cookieParser = require("cookie-parser");

let app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.resolve("./public")));

app.use(cookieParser());

const authenticate = (req, res, next) => {
  const token = req.cookies.jwt;
  if (token) {
    //Verify JWT token and extract user information
    jwt.verify(token, "secret", (err, decoded) => {
      if (err) {
        res.redirect("/login");
      } else {
        next();
      }
    });
  } else {
    res.redirect("/login");
  }
};

let userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    requird: true,
  },
});

let userModel = new mongoose.model("userModel", userSchema);

//connect to database
mongoose.connect(process.env.MONGO_URI);
let databaseOfUsers = mongoose.connection;

databaseOfUsers.on("error", (error) => {
  console.log(`There was an error connecting. Error: ${error}`);
});
databaseOfUsers.once("open", () => {
  console.log(`Connected to database`);
});

//So we can serve stating files to browser.4
app.use(express.static("public"));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("display");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  try {
    let foundUser = await userModel.findOne({ username: req.body.username });
    if (foundUser === null) {
      res.status(404).json({
        message: `Could not find client with username ${req.body.username}`,
      });
    } else {
      bcrypt.compare(req.body.password, foundUser.password).then((response) => {
        if (response === true) {
          let token = jwt.sign({ username: req.body.username }, "secret", {
            expiresIn: 30,
          });
          res.cookie("jwt", token, { httpOnly: true, secure: true }); // do I need third param?
          res.redirect("/drinks");
        } else {
          res.status(401).json({ message: "Password is not correct" });
        }
      });
    }
  } catch (error) {
    console.log(`There was an error: ${error}`);
  }
});

app.get("/register", async (req, res) => {
  res.render("register");
});

app.post("/register", async (req, res) => {
  try {
    let encryptedPass;
    bcrypt.hash(req.body.password, 10).then((hash) => {
      encryptedPass = hash;
      let user = new userModel({
        username: req.body.username,
        password: encryptedPass,
      });
      let newUser = user.save();
      res.redirect("/login");
    });
  } catch (error) {
    res.status(400).json({
      message: `There was an error registering the user: ${error}`,
    });
  }
});

app.get("/drinks", authenticate, (req, res) => {
  res.render("drinks", { drinks: drinks, token: req.cookies.jwt });
});

app.get("/logout", (req, res) => {
  res.clearCookie("jwt");
  res.redirect("/login");
});

app.get("/*", (req, res) => {
  res.render("notFound");
});

app.listen(3000, () => {
  console.log("Listening");
});
