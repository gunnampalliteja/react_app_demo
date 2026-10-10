
import { useEffect, useState } from "react";

const API = "http://localhost:5000/api";
const emptyPlan = {
  title: "", location: "", price: "", days: "", image: "", description: ""
};

export default function App() {
  const [page, setPage] = useState("home");
  const [packages, setPackages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState(localStorage.getItem("name"));
  const [role, setRole] = useState(localStorage.getItem("role") || "user");
  const [plan, setPlan] = useState(emptyPlan);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const token = () => localStorage.getItem("token");

  const request = async (path, options = {}) => {
    const r = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        ...options.headers
      }
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || "Request failed");
    return data;
  };

  const load = async () => {
    try {
      const data = await request("/packages");
      setPackages(data);
    } catch (e) {
      alert(e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const login = async e => {
    e.preventDefault();
    try {
      const x = await request("/login", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(e.target)))
      });
      localStorage.setItem("token", x.token);
      localStorage.setItem("name", x.name);
      localStorage.setItem("role", x.role || "user");
      setUser(x.name);
      setRole(x.role || "user");
      setPage("home");
    } catch (e) {
      alert(e.message);
    }
  };

  const register = async e => {
    e.preventDefault();
    try {
      const x = await request("/register", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(e.target)))
      });
      alert(x.message);
      if (x.message) setPage("login");
    } catch (e) {
      alert(e.message);
    }
  };

  const book = async e => {
    e.preventDefault();
    if (!token()) return setPage("login");

    const data = Object.fromEntries(new FormData(e.target));
    try {
      await request("/bookings", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          package: selected._id,
          people: Number(data.people)
        })
      });
      alert("🎉 Booking confirmed!");
      await getBookings();
    } catch (e) {
      alert(e.message);
    }
  };

  const getBookings = async () => {
    try {
      setBookings(await request("/bookings"));
      setPage("bookings");
    } catch (e) {
      alert(e.message);
      if (!token()) setPage("login");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("name");
    localStorage.removeItem("role");
    setUser(null);
    setRole("user");
    setPage("home");
  };

  const startCreate = () => {
    setEditing(null);
    setPlan(emptyPlan);
    setPage("editor");
  };

  const startEdit = p => {
    setEditing(p._id);
    setPlan({
      title: p.title,
      location: p.location,
      price: String(p.price),
      days: String(p.days),
      image: p.image,
      description: p.description
    });
    setPage("editor");
  };

  const savePlan = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        ...plan,
        price: Number(plan.price),
        days: Number(plan.days)
      };
      await request(editing ? `/packages/${editing}` : "/packages", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(body)
      });
      alert(editing ? "Travel plan updated!" : "Travel plan created!");
      setPage("admin");
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const deletePlan = async id => {
    if (!confirm("Delete this travel plan?")) return;
    try {
      await request(`/packages/${id}`, { method: "DELETE" });
      await load();
      alert("Travel plan deleted.");
    } catch (e) {
      alert(e.message);
    }
  };

  const filtered = packages.filter(p =>
    `${p.title} ${p.location}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <nav>
        <h2 onClick={() => setPage("home")}>✈️ TravelGo</h2>
        <div>
          <button onClick={() => setPage("home")}>Home</button>
          {user && <button onClick={getBookings}>My Bookings</button>}
          {user && role === "admin" &&
            <button onClick={() => setPage("admin")}>👑 Admin Dashboard</button>}
          {user ? <>
            <span>Hi, {user} 👋</span>
            <button onClick={logout}>Logout</button>
          </> : <>
            <button onClick={() => setPage("login")}>Login</button>
            <button onClick={() => setPage("register")}>Register</button>
          </>}
        </div>
      </nav>

      {page === "home" && <>
        <section className="hero">
          <div>
            <h1>Explore the World 🌎</h1>
            <p>Discover amazing destinations and book your next adventure.</p>
            <input placeholder="Search destinations..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
        </section>
        <section className="packages">
          <h2>Popular Travel Packages</h2>
          <div className="grid">
            {filtered.map(p => <article className="card" key={p._id}>
              <img src={p.image} alt={p.title} />
              <div>
                <h3>{p.title}</h3>
                <p>📍 {p.location}</p>
                <p>🗓️ {p.days} Days</p>
                <h3>₹{Number(p.price).toLocaleString()}</h3>
                <button onClick={() => { setSelected(p); setPage("details"); }}>
                  View Package
                </button>
              </div>
            </article>)}
          </div>
          {!filtered.length && <p>No matching destinations found.</p>}
        </section>
      </>}

      {page === "details" && selected && <section className="details">
        <img src={selected.image} alt={selected.title} />
        <div>
          <h1>{selected.title}</h1>
          <h3>📍 {selected.location}</h3>
          <p>{selected.description}</p>
          <h2>₹{Number(selected.price).toLocaleString()}</h2>
          <p>{selected.days} Days</p>
          <button onClick={() => setPage("book")}>Book Now ✈️</button>
        </div>
      </section>}

      {(page === "login" || page === "register") && <form className="form"
        onSubmit={page === "login" ? login : register}>
        <h2>{page === "login" ? "Welcome Back 👋" : "Create Account"}</h2>
        {page === "register" &&
          <input name="name" placeholder="Full name" required />}
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Password"
          minLength="8" required />
        <button>{page === "login" ? "Login" : "Register"}</button>
        <p onClick={() => setPage(page === "login" ? "register" : "login")}>
          {page === "login" ? "Don't have an account? Register" :
            "Already have an account? Login"}
        </p>
      </form>}

      {page === "book" && selected && <form className="form" onSubmit={book}>
        <h2>Book {selected.title}</h2>
        <input name="date" type="date" min={new Date().toISOString().split("T")[0]} required />
        <input name="people" type="number" min="1" max="50"
          defaultValue="1" required />
        <button>Confirm Booking</button>
      </form>}

      {page === "bookings" && <section className="bookings">
        <h1>My Bookings 📋</h1>
        {bookings.length ? bookings.map(b => <div className="booking" key={b._id}>
          {b.package && <>
            <img src={b.package.image} alt={b.package.title} />
            <div>
              <h2>{b.package.title}</h2>
              <p>📍 {b.package.location}</p>
              <p>📅 {b.date}</p>
              <p>👥 {b.people} Traveller(s)</p>
              <h3>₹{Number(b.total).toLocaleString()}</h3>
            </div>
          </>}
        </div>) : <p>No bookings yet.</p>}
      </section>}

      {page === "admin" && role === "admin" && <section className="packages">
        <h1>👑 Admin Dashboard</h1>
        <p>Manage your travel destinations and packages.</p>
        <button onClick={startCreate}>＋ Create Travel Plan</button>
        <div className="grid">
          {packages.map(p => <article className="card" key={p._id}>
            <img src={p.image} alt={p.title} />
            <div>
              <h3>{p.title}</h3>
              <p>📍 {p.location}</p>
              <p>₹{Number(p.price).toLocaleString()} · {p.days} days</p>
              <button onClick={() => startEdit(p)}>✏️ Edit</button>
              <button onClick={() => deletePlan(p._id)}>🗑️ Delete</button>
            </div>
          </article>)}
        </div>
      </section>}

      {page === "admin" && role !== "admin" &&
        <section className="form"><h2>Admin access required</h2></section>}

      {page === "editor" && role === "admin" && <form className="form"
        onSubmit={savePlan}>
        <h2>{editing ? "Edit Travel Plan" : "Create Travel Plan"}</h2>
        <input placeholder="Package title" value={plan.title} required
          onChange={e => setPlan({ ...plan, title: e.target.value })} />
        <input placeholder="Country, state or city" value={plan.location} required
          onChange={e => setPlan({ ...plan, location: e.target.value })} />
        <input type="number" placeholder="Price in ₹" min="1" value={plan.price}
          required onChange={e => setPlan({ ...plan, price: e.target.value })} />
        <input type="number" placeholder="Duration in days" min="1" step="1"
          value={plan.days} required
          onChange={e => setPlan({ ...plan, days: e.target.value })} />
        <input type="url" placeholder="Destination image URL" value={plan.image}
          onChange={e => setPlan({ ...plan, image: e.target.value })} />
        <textarea placeholder="Describe the destination and package"
          value={plan.description} required
          onChange={e => setPlan({ ...plan, description: e.target.value })} />
        <button disabled={busy}>{busy ? "Saving..." : editing ? "Save Changes" : "Create Plan"}</button>
        <button type="button" onClick={() => setPage("admin")}>Cancel</button>
      </form>}
    </>
  );
}
