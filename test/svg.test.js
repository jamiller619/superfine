import { createNode as U, patch } from "../src"

const SVG_NS = "http://www.w3.org/2000/svg"

const deepExpectNS = (element, ns) =>
  Array.from(element.childNodes).map(child => {
    expect(child.namespaceURI).toBe(ns)
    deepExpectNS(child, ns)
  })

test("svg", () => {
  const node = U("div", {}, [
    U("p", { id: "foo" }, "foo"),
    U("svg", { id: "bar", viewBox: "0 0 10 10" }, [
      U("quux", {}, [
        U("beep", {}, [U("ping", {}), U("pong", {})]),
        U("bop", {}),
        U("boop", {}, [U("ping", {}), U("pong", {})])
      ]),
      U("xuuq", {}, [
        U("beep", {}),
        U("bop", {}, [U("ping", {}), U("pong", {})]),
        U("boop", {})
      ])
    ]),
    U("p", { id: "baz" }, "baz")
  ])

  document.body.appendChild(patch(node))

  const foo = document.getElementById("foo")
  const bar = document.getElementById("bar")
  const baz = document.getElementById("baz")

  expect(foo.namespaceURI).not.toBe(SVG_NS)
  expect(baz.namespaceURI).not.toBe(SVG_NS)
  expect(bar.namespaceURI).toBe(SVG_NS)
  expect(bar.getAttribute("viewBox")).toBe("0 0 10 10")
  deepExpectNS(bar, SVG_NS)
})
