# Limitations

## Office.js Shared Runtime

When using xlwings Server with Office.js add-ins, they require the shared runtime. Please consult the [official docs](https://learn.microsoft.com/en-us/javascript/api/requirement-sets/common/shared-runtime-requirement-sets) to see which Excel versions are supported.

## xlwings API coverage

At the moment, xlwings Server doesn't cover yet 100% of the xlwings API. The following attributes are currently missing. If you need them, please reach out so we can prioritize their implementation. Alternatively, you can implement a [workaround](missing_features.md).

```text
xlwings.App

    - cut_copy_mode
    - quit()
    - display_alerts
    - startup_path
    - calculate()
    - status_bar
    - path
    - version
    - screen_updating
    - interactive
    - enable_events
    - calculation

xlwings.Book

    - to_pdf()
    - save()

xlwings.Characters

    - font
    - text

xlwings.Chart

    - set_source_data()
    - to_pdf()
    - parent
    - delete()
    - top
    - width
    - height
    - name
    - to_png()
    - left
    - chart_type

xlwings.Charts

    - add()

xlwings.Font (setting the following properties is supported, only getting them isn't!)

    - size
    - italic
    - color
    - name
    - bold

xlwings.Note

    - delete()
    - text

xlwings.PageSetup

    - print_area

xlwings.Picture

    - top
    - left
    - lock_aspect_ratio

xlwings.Range

    - hyperlink
    - formula
    - font
    - width
    - formula2
    - characters
    - to_png()
    - columns
    - height
    - formula_array
    - paste()
    - rows
    - note
    - merge_cells
    - row_height
    - get_address()
    - merge()
    - to_pdf()
    - autofill()
    - top
    - wrap_text
    - merge_area
    - column_width
    - copy_picture()
    - table
    - unmerge()
    - current_region
    - left

xlwings.Shape

    - parent
    - delete()
    - font
    - top
    - scale_height()
    - activate()
    - width
    - index
    - text
    - height
    - characters
    - name
    - type
    - scale_width()
    - left

xlwings.Sheet

    - page_setup
    - used_range
    - shapes
    - charts
    - autofit()
    - copy()
    - to_html()
    - select()
    - visible

xlwings.Table

    - display_name
    - show_table_style_last_column
    - show_table_style_column_stripes
    - insert_row_range
    - show_table_style_first_column
    - show_table_style_row_stripes
```
