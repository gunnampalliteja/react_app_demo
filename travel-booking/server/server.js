
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("MongoDB error:", err));

const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ["user", "admin"], default: "user" }
}));

const Package = mongoose.model("Package", {
  title: String,
  location: String,
  price: Number,
  days: Number,
  image: String,
  description: String
});

const Booking = mongoose.model("Booking", {
  user: mongoose.Schema.Types.ObjectId,
  package: mongoose.Schema.Types.ObjectId,
  date: String,
  people: Number,
  total: Number
});

const auth = (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer "))
      return res.status(401).json({ message: "Login required" });

    req.user = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

const admin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user || user.role !== "admin")
      return res.status(403).json({ message: "Admin access required" });

    req.user.role = user.role;
    next();
  } catch {
    res.status(500).json({ message: "Authorization failed" });
  }
};

const validPackage = ({ title, location, price, days, image, description }) =>
  typeof title === "string" && !!title.trim() &&
  typeof location === "string" && !!location.trim() &&
  Number.isFinite(price) && price > 0 &&
  Number.isInteger(days) && days > 0 &&
  typeof image === "string" &&
  typeof description === "string";

// REGISTER
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || typeof password !== "string" || password.length < 8)
      return res.status(400).json({
        message: "Name, email and a password of at least 8 characters are required"
      });

    await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 10)
    });

    res.status(201).json({ message: "Registered successfully" });
  } catch (err) {
    res.status(err.code === 11000 ? 409 : 500).json({
      message: err.code === 11000 ? "Email already exists" : "Registration failed"
    });
  }
});

// LOGIN
app.post("/api/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user || !(await bcrypt.compare(req.body.password, user.password)))
      return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      name: user.name,
      role: user.role || "user"
    });
  } catch {
    res.status(500).json({ message: "Login failed" });
  }
});

// LIST PACKAGES
app.get("/api/packages", async (req, res) => {
  try {
    res.json(await Package.find());
  } catch {
    res.status(500).json({ message: "Could not load packages" });
  }
});

// GET ONE PACKAGE
app.get("/api/packages/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(400).json({ message: "Invalid package ID" });

  try {
    const p = await Package.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Package not found" });
    res.json(p);
  } catch {
    res.status(500).json({ message: "Could not load package" });
  }
});

// CREATE PACKAGE — ADMIN ONLY
app.post("/api/packages", auth, admin, async (req, res) => {
  if (!validPackage(req.body))
    return res.status(400).json({ message: "Invalid travel package details" });

  try {
    const p = await Package.create({
      title: req.body.title.trim(),
      location: req.body.location.trim(),
      price: req.body.price,
      days: req.body.days,
      image: req.body.image.trim(),
      description: req.body.description.trim()
    });

    res.status(201).json({ message: "Travel plan created", package: p });
  } catch {
    res.status(500).json({ message: "Could not create travel plan" });
  }
});

// UPDATE PACKAGE — ADMIN ONLY
app.put("/api/packages/:id", auth, admin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(400).json({ message: "Invalid package ID" });

  if (!validPackage(req.body))
    return res.status(400).json({ message: "Invalid travel package details" });

  try {
    const p = await Package.findByIdAndUpdate(
      req.params.id,
      {
        title: req.body.title.trim(),
        location: req.body.location.trim(),
        price: req.body.price,
        days: req.body.days,
        image: req.body.image.trim(),
        description: req.body.description.trim()
      },
      { new: true, runValidators: true }
    );

    if (!p) return res.status(404).json({ message: "Package not found" });
    res.json({ message: "Travel plan updated", package: p });
  } catch {
    res.status(500).json({ message: "Could not update travel plan" });
  }
});

// DELETE PACKAGE — ADMIN ONLY
app.delete("/api/packages/:id", auth, admin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(400).json({ message: "Invalid package ID" });

  try {
    const p = await Package.findByIdAndDelete(req.params.id);

    if (!p) return res.status(404).json({ message: "Package not found" });

    res.json({ message: "Travel plan deleted" });
  } catch {
    res.status(500).json({ message: "Could not delete travel plan" });
  }
});

// BOOK
app.post("/api/bookings", auth, async (req, res) => {
  try {
    const p = await Package.findById(req.body.package);
    const people = Number(req.body.people);

    if (!p) return res.status(404).json({ message: "Package not found" });

    if (!Number.isInteger(people) || people < 1 || people > 50)
      return res.status(400).json({ message: "Invalid number of travellers" });

    const booking = await Booking.create({
      user: req.user.id,
      package: p._id,
      date: req.body.date,
      people,
      total: p.price * people
    });

    res.status(201).json(booking);
  } catch {
    res.status(500).json({ message: "Booking failed" });
  }
});

// MY BOOKINGS
app.get("/api/bookings", auth, async (req, res) => {
  try {
    res.json(await Booking.find({ user: req.user.id }).populate("package"));
  } catch {
    res.status(500).json({ message: "Could not load bookings" });
  }
});

// SAMPLE PACKAGES — DISABLED TO PREVENT ACCIDENTAL DELETION
app.post("/api/seed", (req, res) => {
  res.status(410).json({
    message: "Sample seeding is disabled. Use the admin package creation endpoint."
  });
});

app.listen(5000, () => console.log("Server running on port 5000"));

