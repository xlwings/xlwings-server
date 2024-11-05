# Alpine.js CSP

Alpine.js is a lightweight yet powerful JavaScript framework. When you want to avoid a full server roundtrip with [](htmx.md), you can use Alpine.js to make your HTML page interactive. Compared to writing vanilla JavaScript, Alpine.js CSP brings structure to your code and simplifies many tasks. However, minimal JavaScript knowledge is still required.

The standard version of Alpine.js isn't compatible with the [CSP header](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP). Therefore, xlwings Server includes the [CSP build](https://alpinejs.dev/advanced/csp) by default. The main difference is that you place all your code outside of the HTML tags, meaning the standard Alpine.js documentation needs adaptation for use.

xlwings Server provides an additional command, `registerAlpineComponent()`, to make handling the JavaScript code easier.

Throughout the rest of this page, when we refer to Alpine or Alpine.js, we mean the CSP build of Alpine.js.

## First Steps

To use Alpine.js, add the `x-data` directive to the part of your HTML that you want to bring to life. This converts the specified section into an Alpine component. For optimal performance, apply it to an HTML tag that wraps the smallest possible amount of code.

Let's have a look at the first example under [`app/templates/examples/alpine`](https://github.com/xlwings/xlwings-server/tree/main/app/templates/examples/alpine). For clarity, the [](bootstrap.md) classes that are used in the example aren't shown here so that we can concentrate on the Alpine.js directives:

```html
<div x-data="visibility">
    <button x-text="label" @click="toggle"></button>
    <span x-show="isOpen">The Magic of Alpine.js!</span>
</div>
```

- `x-data` turns the `div` into an Alpine component.
- `x-text` sets the text content of an element, in our case the button, to the value of `label`.
- `x-show` shows or hides an element based on whether `isOpen` is `true` or `false`.
- `@click` runs the `toggle()` method when the button's click event is fired (i.e., when the button is clicked.)

To bring the Alpine component to life, we have to implement the `visibility` object with the `isOpen` and `label` properties and the `toggle()` method. To finalize, the component has to be registered by calling `registerAlpineComponent()`. This function connects the name given in `x-data` with the JavaScript object.

```js
const visibility = {
  isOpen: false,
  label: "Show",

  toggle() {
    this.isOpen = !this.isOpen;
    this.label = this.isOpen ? "Hide" : "Show";
  },
};
registerAlpineComponent("visibility", visibility);
```

## Where to write the Alpine.js JavaScript code

The JavaScript sample code lives in [`app/static/js/core/examples.js`](https://github.com/xlwings/xlwings-server/blob/main/app/static/js/core/examples.js).

If you only have a few Alpine components, you can place the JavaScript code into [`app/static/js/main.js`](https://github.com/xlwings/xlwings-server/blob/main/app/static/js/main.js).

If your task pane turns into a complex app, you could also introduce a proper structure along the following lines:

```none
app/
  static/
    js/
      components/
        auth/
          login-form.js
          signup-form.js
        dashboard/
          data-table.js
          metrics-chart.js
        shared/
          notification.js
          modal.js
```

You could load these JS files on-demand in your templates via

```jinja
{% block extra_head %}
...
{% endblock extra_head %}
```

1. `alpinejs-csp-boilerplate.js`
2. Your own JS module
3. `vendor/@alpinejs/csp/dist/cdn.min.js`

## Directives

Here are the most useful Alpine directives (click on the name to get to the official docs):

- [`x-data`](https://alpinejs.dev/directives/data)
- [`x-show`](https://alpinejs.dev/directives/show)
- [`x-bind`](https://alpinejs.dev/directives/bind) This is usually used via colon, e.g., `:value`.
- [`x-on`](https://alpinejs.dev/directives/on) This is usually used via `@`, e.g., `@click`.
- [`x-text`](https://alpinejs.dev/directives/text)
- [`x-if`](https://alpinejs.dev/directives/if)
- [`x-init`](https://alpinejs.dev/directives/init)

For a complete list, see the [official docs]().

## Init and destroy functions

- If your object contains an `init()` method, Alpine executes it before it renders the component. If your component also has an `x-init` directive, `init()` function will be called first.
- If your object contains a `destroy()` method, Alpine executes it before cleaning up the component.

See the [official docs](https://alpinejs.dev/globals/alpine-data#init-functions).

## Magics

Magic properties and methods start with a `$`, e.g., `$el` and they give you access to a few powerful features. With the CSP build, you have to use them via `this`, e.g., to access the current DOM element:

```js
this.$el
```

For example, you would use this to get the button element that triggered the click event. You can see `$el` in action in the next section about [](#event-object).

For an overview of all magic properties, see the [official docs](https://alpinejs.dev/magics/el).

## Keyboard shortcuts

Alpine.js makes it easy to build keyboard shortcuts. If you want them to be global, them to the `window` object. For example, to focus on a form input element when typing `/`, it's enough to add this attribute to the respective HTML tag:

```html
<input @keydown.window.slash.prevent="focus" />
```

with the corresponding JavaScript method:

```js
focus() {
  this.$el.focus();
}
```

Here's an explanation:

- `keydown` event fires when you press any key
- `window` attaching the event to the `window` object allows you to listen to it globally
- `slash` this is the key pressed
- `prevent` this prevents the default behavior, as otherwise it would write `/` into the text box.

You can try this example out by going to the name example under [`app/templates/examples/alpine`](https://github.com/xlwings/xlwings-server/tree/main/app/templates/examples/alpine).

## Event object

If you have advanced needs, you can access the `event` object when handling one. This is JavaScript part of the slider example:

```js
const slider = {
  percentage: 50,
  update() {
    this.percentage = this.$el.value;
  },
};
```

Instead of using the `$el` magic, you could also use the `event` object directly like so:

```js
const slider = {
  percentage: 50,
  update(event) {
    this.percentage = event.target.value;
  },
};
```

Alternatively, you could also use Alpine's `$event` magic:

```js
const slider = {
  percentage: 50,
  update() {
    this.percentage = this.$event.target.value;
  },
};
```

However, using the CSP build, explicitly passing the `event` means less typing and is arguably more elegant.

## Alpine.js vs Alpine.js CSP build

The CSP build doesn't support everything from standard Alpine.js. Here's a list of limitations:

- `x-model` isn't supported. Instead, use a combination of `:value` and `@input`, see the name example in [`app/templates/examples/alpine`](https://github.com/xlwings/xlwings-server/tree/main/app/templates/examples/alpine)
- When you work with AI, prompt it to deliver the solution using `Alpine.data()`, as this is essentially what the CSP build uses behind the scenes.

## Alternatives

- [Vanilla JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- [jQuery](https://jquery.com/)
- [Stimulus](https://stimulus.hotwired.dev/)
- [Hyperscript](https://hyperscript.org/)
- [Vue.js](https://vuejs.org/guide/quick-start.html#using-vue-from-cdn)
