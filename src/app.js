import express from "express";
import { db, getAllTodos, getTodoById } from "./db.js";
import {
	sendTodoDeletedToAllConnections,
	sendTodoDetailToAllConnections,
	sendTodoListToAllConnections,
} from "./websockets.js";

export const app = express();

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

	if (!title) {
		res.status(400).send("Title is required");
		return;
	}

	await db("todos").insert({ title });

	sendTodoListToAllConnections();

	res.redirect("/");
});

app.get("/remove-todo/:id", async (req, res, next) => {
	const todo = await db("todos").select("*").where("id", req.params.id).first();

	if (!todo) {
		res.status(404).send("404 - Todo not found");
		return;
	}

	await db("todos").delete().where("id", req.params.id);

	sendTodoListToAllConnections();
	sendTodoDeletedToAllConnections(req.params.id);

	res.redirect("/");
});

app.get("/toggle-todo/:id", async (req, res, next) => {
	const todo = await getTodoById(req.params.id);

	if (!todo) {
		res.status(404).send("404 - Todo not found");
		return;
	}

	await db("todos").update({ done: !todo.done }).where("id", req.params.id);

	sendTodoListToAllConnections();
	sendTodoDetailToAllConnections(req.params.id);

	res.redirect("back");
});

app.get("/todo/:id", async (req, res) => {
	const todo = await getTodoById(req.params.id);

	if (!todo) {
		res.status(404).send("404 - Todo not found");
		return;
	}

	res.render("todo", { todo });
});

app.post("/todo/:id", async (req, res, next) => {
	const todo = await getTodoById(req.params.id);

	if (!todo) return next();

	const query = db("todos").where("id", todo.id);

	if (req.body.title) query.update({ title: req.body.title });
	if (req.body.priority) query.update({ priority: req.body.priority });

	await query;

	sendTodoListToAllConnections();
	sendTodoDetailToAllConnections(todo.id);

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
