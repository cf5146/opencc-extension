import { describe, expect, it, vi } from "vitest";
import { createConversionQueue } from "../src/application/auto/conversion-queue.js";

describe("conversion queue", () => {
  it("yields after an expensive conversion instead of consuming the entire queue", () => {
    document.body.innerHTML = "<p>漢字</p>".repeat(10);
    let now = 0;
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
    const tasks: Array<() => void> = [];
    const convert = vi.fn((_node: Text) => {
      now += 9;
    });
    const queue = createConversionQueue({
      document,
      convert,
      schedule: (callback) => {
        tasks.push(callback);
        return callback;
      },
      cancel: () => {},
    });
    try {
      queue.enqueue(document.body);
      tasks.shift()!();
      expect(convert).toHaveBeenCalledTimes(1);
      while (tasks.length) tasks.shift()!();
      expect(convert).toHaveBeenCalledTimes(10);
    } finally {
      clock.mockRestore();
      queue.clear();
    }
  });

  it("finishes remaining content when the current traversal node is removed between batches", () => {
    document.body.innerHTML = "<p>漢字</p>".repeat(300);
    const paragraphs = [...document.querySelectorAll("p")];
    const tasks: Array<() => void> = [];
    const convert = vi.fn((_node: Text) => {});
    const queue = createConversionQueue({
      document,
      convert,
      schedule: (callback) => {
        tasks.push(callback);
        return callback;
      },
      cancel: () => {},
    });
    queue.enqueue(document.body);
    tasks.shift()!();
    const lastVisited = convert.mock.calls.at(-1)![0];
    lastVisited.parentElement!.remove();
    while (tasks.length) tasks.shift()!();
    expect(convert).toHaveBeenCalledWith(paragraphs[299]!.firstChild);
  });
  it("deduplicates nested roots and yields before finishing a large tree", () => {
    document.body.innerHTML = "<section>" + "<p>漢字</p>".repeat(1000) + "</section>";
    const scheduled: Array<() => void> = [];
    const convert = vi.fn();
    const queue = createConversionQueue({
      document,
      convert,
      schedule: (callback) => {
        scheduled.push(callback);
        return callback;
      },
      cancel: () => {},
    });
    queue.enqueue(document.body);
    queue.enqueue(document.querySelector("section")!);
    expect(convert).not.toHaveBeenCalled();
    scheduled.shift()!();
    expect(convert.mock.calls.length).toBeGreaterThan(0);
    expect(convert.mock.calls.length).toBeLessThan(1000);
    while (scheduled.length) scheduled.shift()!();
    expect(convert).toHaveBeenCalledTimes(1000);
  });

  it("drops detached nodes and cancels work on shutdown", () => {
    const scheduled: Array<() => void> = [];
    const convert = vi.fn();
    const queue = createConversionQueue({
      document,
      convert,
      schedule: (cb) => {
        scheduled.push(cb);
        return cb;
      },
      cancel: () => {},
    });
    const node = document.createTextNode("漢字");
    document.body.append(node);
    queue.enqueue(node);
    node.remove();
    scheduled.shift()!();
    expect(convert).not.toHaveBeenCalled();
    queue.enqueue(document.body);
    queue.clear();
    while (scheduled.length) scheduled.shift()!();
    expect(convert).not.toHaveBeenCalled();
  });
});
