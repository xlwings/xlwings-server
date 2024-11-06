# Bootstrap

By default, xlwings Server uses Bootstrap 5 as its UI (user interface) toolkit. Bootstrap is responsible for making fonts, buttons, etc. look beautiful across different browsers and operating systems. It also offers a range of useful components, such as navbars, dropdowns and many more.

It is _responsive_, which means that it can adopt to different screen sizes by rearranging components or by changing the size of pictures. This is useful as the task pane can be extended to cover half of Excel's grid.

Most of the time, Bootstrap works by simply adding class names to your HTML tags, without having to write any CSS or JavaScript.

## First Steps

To create your user interface, you can often get pretty far by going to the [Bootstrap documentation](https://getbootstrap.com/docs) and copy/pasting from their samples.

For example, if you want to add a dropdown button, you can copy code snippets from the [Dropdowns](https://getbootstrap.com/docs/5.3/components/dropdowns/) page in the docs.

The next step would be to turn the copied snippet into a [](jinja.md) template. Under [`app/templates/examples/pictures/taskpane_pictures.html`](https://github.com/xlwings/xlwings-server/blob/main/app/templates/examples/pictures/taskpane_pictures.html), you can see an example that does just that.

## Advanced Bootstrap

To get a deeper understanding of Bootstrap, have a look at the following topics:

- [Containers](https://getbootstrap.com/docs/5.3/layout/containers/)
- [Grid](https://getbootstrap.com/docs/5.3/layout/grid/)
- Bootstrap is based on flexbox. Understanding it will help you position your components correctly on the screen. You can get an introduction on [mdn web doc](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Basic_concepts_of_flexbox) before having a look at the [Bootstrap-specific docs](https://getbootstrap.com/docs/5.3/utilities/flex/).

## Alternatives

- [Pico CSS](https://picocss.com/)
- [Bulma](https://bulma.io/)
- [Tailwind CSS](https://tailwindcss.com/)

For more options, see [Awesome CSS Frameworks](https://github.com/troxler/awesome-css-frameworks).

## References

- [Bootstrap Homepage](https://getbootstrap.com/)
- [Bootstrap Docs](https://getbootstrap.com/docs)
- [Bootstrap-xlwings](https://github.com/xlwings/bootstrap-xlwings)
