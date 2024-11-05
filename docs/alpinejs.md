# Alpine.js CSP

Alpine.js is a lightweight JavaScript framework that brings client-side interactivity to your page. Compared with writing vanilla JavaScript, Alpine.js CSP simplifies many tasks and brings your code into a maintainable structure. However, basic JavaScript knowledge is still required. Compared with [](htmx.md), Alpine.js is for client-side interactivity, while [](htmx.md) is for client-server interaction.

The standard version of Alpine.js isn't compatible with the [CSP header](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP). Therefore, xlwings Server includes the [CSP build](https://alpinejs.dev/advanced/csp) by default. The main difference is that you place all your code outside of the HTML tags, meaning the standard Alpine.js documentation needs adaptation for use.

xlwings Server provides a helper function, `registerAlpineComponent()`, which makes it easier to connect the HTML with the JavaScript part.

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
- `@click` runs the `toggle()` method when the button's click event is fired (i.e., when the button is clicked).

To bring the Alpine component to life, we have to implement the `visibility` object with the `isOpen` and `label` properties and the `toggle()` method. To finalize, the component has to be registered by calling `registerAlpineComponent()`. This function connects `x-data` name with the JavaScript object.

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
          ___.js
        dashboard/
          ___.js
        shared/
          ___.js
          ___.js
```

You could load these JS files on-demand in your templates via

```jinja
{% block extra_head %}
...
{% endblock extra_head %}
```

If you want to load the code in `base.html`, make sure to load `alpinejs-csp-boilerplate.js` first before your own code and finally `vendor/@alpinejs/csp/dist/cdn.min.js`.

## Directives

Here are the most useful Alpine directives (click on the name to get to the official docs):

- [`x-data`](https://alpinejs.dev/directives/data): initialize an Alpine component.
- [`x-show`](https://alpinejs.dev/directives/show): show/hide an element.
- [`x-bind`](https://alpinejs.dev/directives/bind): set attributes on an element. This is usually used via the colon shorthand, e.g., `:value` or `:class`.
- [`x-on`](https://alpinejs.dev/directives/on): listen for browser events. This is usually used via the `@` shorthand, e.g., `@click`.
- [`x-text`](https://alpinejs.dev/directives/text): set the text content of an element.
- [`x-if`](https://alpinejs.dev/directives/if): adds/removes a block of HTML from the page completely (doesn't just show/hide it).
- [`x-init`](https://alpinejs.dev/directives/init): runs code when the Alpine component is initialized.

For a complete list, see the [official docs](https://alpinejs.dev/directives/data).

## Init and destroy functions

- If your object contains an `init()` method, Alpine executes it before it renders the component. If your component also has an `x-init` directive, `init()` function will be called first.
- If your object contains a `destroy()` method, Alpine executes it before cleaning up the component.

See the [official docs](https://alpinejs.dev/globals/alpine-data#init-functions).

## Magics

Magic properties and methods start with a `$`, e.g., `$el` and they give you access to a few powerful features. With the CSP build, you have to use them via `this`, e.g., to access the current DOM element:

```js
this.$el
```

You could use `this.$el` to get the button element that triggered the click event. You can see `$el` in action below in the section about [](#event-object).

For an overview of all magic properties, see the [official docs](https://alpinejs.dev/magics/el).

## Keyboard shortcuts

Alpine.js makes it easy to build keyboard shortcuts. If you want them to be global, you need to include the `window` modifier so that Alpine registers the event listener on the `window` object instead of on the element itself. For example, to focus on a form input element when typing `/`, it's enough to add this attribute to the respective element:

```html
<input @keydown.window.slash.prevent="focus" />
```

with the corresponding JavaScript method:

```js
focus() {
  this.$el.focus();
}
```

To see the full context and give it a try, have a look at the "Names" example under [`app/templates/examples/alpine`](https://github.com/xlwings/xlwings-server/tree/main/app/templates/examples/alpine).

Let's go through how everything works:

- `keydown`: this event fires when you press any key
- `window`: attaching the event to the `window` object allows you to listen to it globally
- `slash`: it listens for the `/` key
- `prevent`: this prevents the default behavior, as otherwise it would write `/` into the text box.

For an overview of all available modifiers for your event listeners, have a look at the [official docs](https://alpinejs.dev/directives/on#modifiers).

## Event object

If you have advanced needs, you can access the `event` object when handling an event. Let's have a look at the JavaScript part of the "Slider" example under [`app/templates/examples/alpine`](https://github.com/xlwings/xlwings-server/tree/main/app/templates/examples/alpine):

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

- `x-model` isn't supported. Instead, use a combination of `@input` and `:value`.
- When you work with AI, prompt it to deliver the solution using `Alpine.data()`, as this is essentially what the CSP build uses behind the scenes.

## Alternatives

If you don't want to use Alpine.js, you may want to have a look into one of the following alternatives:

- [Vanilla JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- [jQuery](https://jquery.com/)
- [Hyperscript](https://hyperscript.org/)
- [Vue.js](https://vuejs.org/guide/quick-start.html#using-vue-from-cdn)
- [Stimulus](https://stimulus.hotwired.dev/)
