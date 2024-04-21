import test from "ava";
import supertest from "supertest";
import { app } from "../src/app.js";
import { db } from "../src/db.js";

test.beforeEach(async () => {
	await db.migrate.latest();
});

test.afterEach(async () => {
	await db.migrate.rollback();
});

test.serial("it renders a list of todos", async (t) => {
	const response = await supertest.agent(app).get("/");

	t.assert(response.text.includes("<h1>ToDos!</h1>"));
});

test.serial("create new todo", async (t) => {
	await db("todos").insert({
		title: "Moje todo",
	});

	const response = await supertest.agent(app).get("/");

	t.assert(response.text.includes("Moje todo"));
});

test.serial("create new todo via form", async (t) => {
	const response = await supertest
		.agent(app)
		.post("/add-todo")
		.type("form")
		.send({ title: "Nějaký název" })
		.redirects(1);

	t.assert(response.text.includes("Nějaký název"));
});

test.serial("toggle todo status", async (t) => {
	const [todoId] = await db("todos").insert({
		title: "Test Todo",
	});

	await supertest(app).get(`/toggle-todo/${todoId}`).expect(302);

	const updatedTodo = await db("todos").where("id", todoId).first();

	t.assert(updatedTodo.done, "1");
});

test.serial("update todo", async (t) => {
	const [todoId] = await db("todos").insert({
		title: "Test Todo",
		priority: 5,
	});

	const updatedTitle = "Updated Todo";
	const updatedPriority = 8;

	const response = await supertest
		.agent(app)
		.post(`/todo/${todoId}`)
		.type("form")
		.send({ title: updatedTitle, priority: updatedPriority })
		.redirects(1);

	t.assert(response.text.includes(updatedTitle));
	t.assert(response.text.includes(updatedPriority));

	const updatedTodo = await db("todos").where("id", todoId).first();
	t.is(updatedTodo.title, updatedTitle);
	t.is(updatedTodo.priority, updatedPriority);
});

test.serial("delete todo", async (t) => {
	const [todoId] = await db("todos").insert({
		title: "Test Todo",
	});

	const response = await supertest
		.agent(app)
		.get(`/remove-todo/${todoId}`)
		.expect(302);

	const todoExists = await db("todos").where("id", todoId).first();
	t.assert(!todoExists, "Todo should be deleted");
});

test.serial("display todo detail", async (t) => {
	const todo = {
		title: "Test Todo",
		priority: 5,
		done: false,
	};

	const [todoId] = await db("todos").insert(todo);

	const response = await supertest
		.agent(app)
		.get(`/todo/${todoId}`)
		.expect(200);

	t.assert(response.text.includes(todo.title));
	t.assert(response.text.includes(todo.priority));
	t.assert(response.text.includes("Nehotovo"));
});

test.serial("create new todo without title", async (t) => {
	const response = await supertest
		.agent(app)
		.post("/add-todo")
		.type("form")
		.send({ title: "" })
		.expect(400);

	t.assert(response.text.includes("Title is required"));
});

test.serial("access non-existing todo detail", async (t) => {
	const response = await supertest
		.agent(app)
		.get("/todo/9999999999")
		.timeout(5000);

	t.is(response.status, 404);
	t.assert(response.text.includes("404 - Todo not found"));
});

test.serial("toggle non-existent todo status", async (t) => {
	const response = await supertest.agent(app).get("/toggle-todo/9999999999");

	t.is(response.status, 404);
	t.assert(response.text.includes("404 - Todo not found"));
});

test.serial("delete non-existent todo", async (t) => {
	const response = await supertest.agent(app).get("/remove-todo/9999999999");

	t.is(response.status, 404);
	t.assert(response.text.includes("404 - Todo not found"));
});
