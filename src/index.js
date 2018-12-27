const DEFAULT = 0
const RECYCLED_NODE = 1
const TEXT_NODE = 2

const XLINK_NS = "http://www.w3.org/1999/xlink"
const SVG_NS = "http://www.w3.org/2000/svg"

const EMPTY_OBJECT = {}
const EMPTY_ARRAY = []

const map = EMPTY_ARRAY.map
const isArray = Array.isArray

const flatten = arr => arr.reduce((a, b) => a.concat(b), [])

const eventProxy = event => event.currentTarget.events[event.type](event)

const updateProp = (el, name, lastValue, nextValue, isSvg) => {
  if (name === "key") {
  } else if (name === "style") {
    for (var i in Object.assign({}, lastValue, nextValue)) {
      var style = nextValue == null || nextValue[i] == null ? "" : nextValue[i]
      if (i[0] === "-") {
        el[name].setProperty(i, style)
      } else {
        el[name][i] = style
      }
    }
  } else {
    if (name[0] === "o" && name[1] === "n") {
      if (!el.events) el.events = {}

      el.events[(name = name.slice(2))] = nextValue

      if (nextValue == null) {
        el.removeEventListener(name, eventProxy)
      } else if (lastValue == null) {
        el.addEventListener(name, eventProxy)
      }
    } else {
      var nullOrFalse = nextValue == null || nextValue === false

      if (
        name in el &&
        name !== "list" &&
        name !== "draggable" &&
        name !== "spellcheck" &&
        name !== "translate" &&
        !isSvg
      ) {
        el[name] = nextValue == null ? "" : nextValue
        if (nullOrFalse) {
          el.removeAttribute(name)
        }
      } else {
        var ns = isSvg && name !== (name = name.replace(/^xlink:?/, ""))
        if (ns) {
          if (nullOrFalse) {
            el.removeAttributeNS(XLINK_NS, name)
          } else {
            el.setAttributeNS(XLINK_NS, name, nextValue)
          }
        } else {
          if (nullOrFalse) {
            el.removeAttribute(name)
          } else {
            el.setAttribute(name, nextValue)
          }
        }
      }
    }
  }
}

const createElement = (node, lifecycle, isSvg) => {
  const el =
    node.type === TEXT_NODE
      ? document.createTextNode(node.name)
      : (isSvg = isSvg || node.name === "svg")
        ? document.createElementNS(SVG_NS, node.name)
        : document.createElement(node.name)

  const props = node.props
  if (props.oncreate) {
    lifecycle.push(() => props.oncreate(el))
  }

  [...node.children].forEach(child => el.appendChild(createElement(child, lifecycle, isSvg)))

  for (var name in props) {
    updateProp(el, name, null, props[name], isSvg)
  }

  return (node.el = el)
}

const updateElement = (
  el,
  lastProps,
  nextProps,
  lifecycle,
  isSvg,
  isRecycled
) => {
  for (var name in Object.assign({}, lastProps, nextProps)) {
    if (
      (name === "value" || name === "checked"
        ? el[name]
        : lastProps[name]) !== nextProps[name]
    ) {
      updateProp(el, name, lastProps[name], nextProps[name], isSvg)
    }
  }

  var cb = isRecycled ? nextProps.oncreate : nextProps.onupdate
  if (cb != null) {
    lifecycle.push(function() {
      cb(el, lastProps)
    })
  }
}

const removeChildren = node => {
  for (var i = 0, length = node.children.length; i < length; i++) {
    removeChildren(node.children[i])
  }

  var cb = node.props.ondestroy
  if (cb != null) {
    cb(node.el)
  }

  return node.el
}

var removeElement = function(parent, node) {
  var remove = function() {
    parent.removeChild(removeChildren(node))
  }

  var cb = node.props && node.props.onremove
  if (cb != null) {
    cb(node.el, remove)
  } else {
    remove()
  }
}

const getKey = node => node == null ? null : node.key

const createKeyMap = (children, start, end) => {
  var out = {}
  var key
  var node

  for (; start <= end; start++) {
    if ((key = (node = children[start]).key) != null) {
      out[key] = node
    }
  }

  return out
}

const patchElement = (
  parent,
  el,
  lastNode,
  nextNode,
  lifecycle,
  isSvg
) => {
  if (nextNode === lastNode) {
  } else if (
    lastNode != null &&
    lastNode.type === TEXT_NODE &&
    nextNode.type === TEXT_NODE
  ) {
    if (lastNode.name !== nextNode.name) {
      el.nodeValue = nextNode.name
    }
  } else if (lastNode == null || lastNode.name !== nextNode.name) {
    var newElement = parent.insertBefore(
      createElement(nextNode, lifecycle, isSvg),
      el
    )

    if (lastNode != null) removeElement(parent, lastNode)

    el = newElement
  } else {
    updateElement(
      el,
      lastNode.props,
      nextNode.props,
      lifecycle,
      (isSvg = isSvg || nextNode.name === "svg"),
      lastNode.type === RECYCLED_NODE
    )

    var savedNode
    var childNode

    var lastKey
    var lastChildren = lastNode.children
    var lastChStart = 0
    var lastChEnd = lastChildren.length - 1

    var nextKey
    var nextChildren = nextNode.children
    var nextChStart = 0
    var nextChEnd = nextChildren.length - 1

    while (nextChStart <= nextChEnd && lastChStart <= lastChEnd) {
      lastKey = getKey(lastChildren[lastChStart])
      nextKey = getKey(nextChildren[nextChStart])

      if (lastKey == null || lastKey !== nextKey) break

      patchElement(
        el,
        lastChildren[lastChStart].el,
        lastChildren[lastChStart],
        nextChildren[nextChStart],
        lifecycle,
        isSvg
      )

      lastChStart++
      nextChStart++
    }

    while (nextChStart <= nextChEnd && lastChStart <= lastChEnd) {
      lastKey = getKey(lastChildren[lastChEnd])
      nextKey = getKey(nextChildren[nextChEnd])

      if (lastKey == null || lastKey !== nextKey) break

      patchElement(
        el,
        lastChildren[lastChEnd].el,
        lastChildren[lastChEnd],
        nextChildren[nextChEnd],
        lifecycle,
        isSvg
      )

      lastChEnd--
      nextChEnd--
    }

    if (lastChStart > lastChEnd) {
      while (nextChStart <= nextChEnd) {
        el.insertBefore(
          createElement(nextChildren[nextChStart++], lifecycle, isSvg),
          (childNode = lastChildren[lastChStart]) && childNode.el
        )
      }
    } else if (nextChStart > nextChEnd) {
      while (lastChStart <= lastChEnd) {
        removeElement(el, lastChildren[lastChStart++])
      }
    } else {
      var lastKeyed = createKeyMap(lastChildren, lastChStart, lastChEnd)
      var nextKeyed = {}

      while (nextChStart <= nextChEnd) {
        lastKey = getKey((childNode = lastChildren[lastChStart]))
        nextKey = getKey(nextChildren[nextChStart])

        if (
          nextKeyed[lastKey] ||
          (nextKey != null && nextKey === getKey(lastChildren[lastChStart + 1]))
        ) {
          if (lastKey == null) {
            removeElement(el, childNode)
          }
          lastChStart++
          continue
        }

        if (nextKey == null || lastNode.type === RECYCLED_NODE) {
          if (lastKey == null) {
            patchElement(
              el,
              childNode && childNode.el,
              childNode,
              nextChildren[nextChStart],
              lifecycle,
              isSvg
            )
            nextChStart++
          }
          lastChStart++
        } else {
          if (lastKey === nextKey) {
            patchElement(
              el,
              childNode.el,
              childNode,
              nextChildren[nextChStart],
              lifecycle,
              isSvg
            )
            nextKeyed[nextKey] = true
            lastChStart++
          } else {
            if ((savedNode = lastKeyed[nextKey]) != null) {
              patchElement(
                el,
                el.insertBefore(
                  savedNode.el,
                  childNode && childNode.el
                ),
                savedNode,
                nextChildren[nextChStart],
                lifecycle,
                isSvg
              )
              nextKeyed[nextKey] = true
            } else {
              patchElement(
                el,
                childNode && childNode.el,
                null,
                nextChildren[nextChStart],
                lifecycle,
                isSvg
              )
            }
          }
          nextChStart++
        }
      }

      while (lastChStart <= lastChEnd) {
        if (getKey((childNode = lastChildren[lastChStart++])) == null) {
          removeElement(el, childNode)
        }
      }

      for (var key in lastKeyed) {
        if (nextKeyed[key] == null) {
          removeElement(el, lastKeyed[key])
        }
      }
    }
  }

  return (nextNode.el = el)
}

const createVNode = (name, props, children, el, key, type) => ({
  name: name,
  props: props,
  children: children,
  el: el,
  key: key,
  type: type
})

const createTextVNode = (text, el) => createVNode(text, EMPTY_OBJECT, EMPTY_ARRAY, el, null, TEXT_NODE)

const recycleChild = el => el.nodeType === 3
  ? createTextVNode(el.nodeValue, el)
  : recycleElement(el)

const recycleElement = el => createVNode(
  el.nodeName.toLowerCase(),
  EMPTY_OBJECT,
  map.call(el.childNodes, recycleChild),
  el,
  null,
  RECYCLED_NODE
)

export const recycle = function(container) {
  return recycleElement(container.children[0])
}

export const patch = function(lastNode, nextNode, container) {
  var lifecycle = []

  patchElement(container, container.children[0], lastNode, nextNode, lifecycle)

  while (lifecycle.length > 0) lifecycle.pop()()

  return nextNode
}

export const h = function(name, props) {
  var node
  var rest = []
  var children = []
  var length = arguments.length

  while (length-- > 2) rest.push(arguments[length])

  if ((props = props == null ? {} : props).children != null) {
    if (rest.length <= 0) {
      rest.push(props.children)
    }
    delete props.children
  }

  while (rest.length > 0) {
    if (isArray((node = rest.pop()))) {
      for (length = node.length; length-- > 0; ) {
        rest.push(node[length])
      }
    } else if (node === false || node === true || node == null) {
    } else {
      children.push(typeof node === "object" ? node : createTextVNode(node))
    }
  }

  return typeof name === "function"
    ? name(props, (props.children = children))
    : createVNode(name, props, children, null, props.key, DEFAULT)
}
