import express from "express";
import { db, getAllTodos, getTodoById } from "./src/db.js";
import {
	createWebSocketServer,
	sendTodoListToAllConnections,
} from "./src/websockets.js";

const app = express();

app.set("view engine", "ejs");

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
	console.log("Incomming request", req.method, req.url);
	next();
});

app.get("/", async (req, res) => {
	const todos = await getAllTodos();

	res.render("index", {
		title: "ToDos!",
		todos,
	});
});

app.post("/add-todo", async (req, res) => {
	const title = String(req.body.title);

	await db("todos").insert({ title });

	res.redirect("/");
});

app.get("/remove-todo/:id", async (req, res, next) => {
	const todo = await db("todos").select("*").where("id", req.params.id).first();

	if (!todo) return next();

	await db("todos").delete().where("id", req.params.id);

	sendTodoListToAllConnections();

	res.redirect("/");
});

app.get("/toggle-todo/:id", async (req, res, next) => {
	const todo = await getTodoById(req.params.id);

	if (!todo) return next();

	await db("todos").update({ done: !todo.done }).where("id", req.params.id);

	sendTodoListToAllConnections();

	res.redirect("back");
});

app.get("/todo/:id", async (req, res) => {
	const todo = await getTodoById(req.params.id);

	if (!todo) return next();

	res.render("todo", { todo });
});

app.post("/todo/:id", async (req, res, next) => {
	const todo = await getTodoById(req.params.id);

	if (!todo) return next();

	const query = db("todos").where("id", todo.id);

	if (req.body.title) query.update({ title: req.body.title });
	if (req.body.priority) query.update({ priority: req.body.priority });

	await query;

	res.redirect("back");
});

app.use((req, res) => {
	res.status(404);
	res.send("404 - Page not found");
});

app.use((err, req, res, next) => {
	console.error(err);
	res.status(500);
	res.send("500 - Server error");
});

const server = app.listen(3000, () => {
	console.log("Server listening on http://localhost:3000");
});

createWebSocketServer(server);
