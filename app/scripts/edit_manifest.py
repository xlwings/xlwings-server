from pathlib import Path

from lxml import etree

NAMESPACES = {
    None: "http://schemas.microsoft.com/office/appforoffice/1.1",
    "bt": "http://schemas.microsoft.com/office/officeappbasictypes/1.0",
    "ov": "http://schemas.microsoft.com/office/taskpaneappversionoverrides",
    "xsi": "http://www.w3.org/2001/XMLSchema-instance",
}
NAMESPACE_OV = "http://schemas.microsoft.com/office/taskpaneappversionoverrides"


def add_resources_for_button(tree, button_id, label_text, tooltip_text):
    # Create namespace map without default namespace
    string_nsmap = {k: v for k, v in NAMESPACES.items() if k is not None}

    # Find or create Resources element
    resources = tree.find(f".//{{{NAMESPACE_OV}}}Resources")
    if resources is None:
        version_overrides = tree.find(f".//{{{NAMESPACE_OV}}}VersionOverrides")
        resources = etree.SubElement(version_overrides, f"{{{NAMESPACE_OV}}}Resources")

    # Find or create ShortStrings
    short_strings = resources.find(".//{%s}ShortStrings" % NAMESPACES["bt"])
    if short_strings is None:
        short_strings = etree.SubElement(
            resources, "{%s}ShortStrings" % NAMESPACES["bt"], nsmap=NAMESPACES
        )

    # Find or create LongStrings
    long_strings = resources.find(".//{%s}LongStrings" % NAMESPACES["bt"])
    if long_strings is None:
        long_strings = etree.SubElement(
            resources, "{%s}LongStrings" % NAMESPACES["bt"], nsmap=NAMESPACES
        )

    # Add label (short string) with DefaultValue
    etree.SubElement(
        short_strings,
        "{%s}String" % NAMESPACES["bt"],
        {"id": f"{button_id}.Label", "DefaultValue": label_text},
        nsmap=string_nsmap,
    )

    # Add tooltip (long string) with DefaultValue
    etree.SubElement(
        long_strings,
        "{%s}String" % NAMESPACES["bt"],
        {"id": f"{button_id}.Tooltip", "DefaultValue": tooltip_text},
        nsmap=string_nsmap,
    )


def add_button_to_ribbon_group(
    tree, group_id, button_id, function_name, label_text, tooltip_text
):
    # First add the resources
    add_resources_for_button(tree, button_id, label_text, tooltip_text)
    # Find group using xpath with namespace
    group_elem = tree.find(f".//*[@id='{group_id}']")
    if group_elem is None:
        return False

    # Create button element
    new_button = etree.SubElement(
        group_elem,
        f"{{{NAMESPACE_OV}}}Control",
        {
            "{http://www.w3.org/2001/XMLSchema-instance}type": "Button",
            "id": button_id,
        },
    )

    # Add label
    etree.SubElement(
        new_button, f"{{{NAMESPACE_OV}}}Label", {"resid": f"{button_id}.Label"}
    )

    # Add Supertip
    supertip = etree.SubElement(new_button, f"{{{NAMESPACE_OV}}}Supertip")
    etree.SubElement(
        supertip, f"{{{NAMESPACE_OV}}}Title", {"resid": f"{button_id}.Label"}
    )
    etree.SubElement(
        supertip, f"{{{NAMESPACE_OV}}}Description", {"resid": f"{button_id}.Tooltip"}
    )

    # Add Icon with bt namespace
    icon = etree.SubElement(new_button, f"{{{NAMESPACE_OV}}}Icon")
    for size in [16, 32, 80]:
        etree.SubElement(
            icon,
            "{%s}Image" % NAMESPACES["bt"],
            {"size": str(size), "resid": f"Icon.{size}x{size}"},
            nsmap={"bt": NAMESPACES["bt"]},
        )

    # Add Action
    action = etree.SubElement(
        new_button,
        f"{{{NAMESPACE_OV}}}Action",
        {"{http://www.w3.org/2001/XMLSchema-instance}type": "ExecuteFunction"},
    )
    etree.SubElement(action, f"{{{NAMESPACE_OV}}}FunctionName").text = function_name

    return True


if __name__ == "__main__":
    p = Path(__file__).parent / "../templates/manifest.xml"

    # Parse while preserving docinfo
    parser = etree.XMLParser(
        remove_blank_text=True, remove_comments=False, strip_cdata=False
    )
    tree = etree.parse(str(p), parser)

    success = add_button_to_ribbon_group(
        tree,
        "MyCommandsGroup",
        "MyFunctionButton2",
        "hello-ribbon2",
        "My Button",  # Label text
        "Click this button to run the function",  # Tooltip text
    )

    if success:
        # Write back with standalone="yes"
        tree.write(
            str(p),
            encoding="utf-8",
            xml_declaration=True,
            pretty_print=True,
            standalone=True,
        )
        print(f"Updated {p}")
    else:
        print("Failed to find group")
