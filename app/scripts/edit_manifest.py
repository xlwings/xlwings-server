from pathlib import Path

from lxml import etree

NSMAP = {
    None: "http://schemas.microsoft.com/office/appforoffice/1.1",
    "bt": "http://schemas.microsoft.com/office/officeappbasictypes/1.0",
    "ov": "http://schemas.microsoft.com/office/taskpaneappversionoverrides",
    "xsi": "http://www.w3.org/2001/XMLSchema-instance",
}
NSMAP_NO_ROOT = {k: v for k, v in NSMAP.items() if k is not None}


def add_resources_for_button(tree, button_id, label_text, tooltip_text):
    # Find or create Resources element
    resources = tree.find(f".//{{{NSMAP['ov']}}}Resources")
    if resources is None:
        version_overrides = tree.find(f".//{{{NSMAP['ov']}}}VersionOverrides")
        resources = etree.SubElement(version_overrides, f"{{{NSMAP['ov']}}}Resources")

    # Find or create ShortStrings
    short_strings = resources.find(f".//{{{NSMAP['bt']}}}ShortStrings")
    if short_strings is None:
        short_strings = etree.SubElement(
            resources, f"{{{NSMAP['bt']}}}ShortStrings", nsmap=NSMAP
        )

    # Find or create LongStrings
    long_strings = resources.find(f".//{{{NSMAP['bt']}}}LongStrings")
    if long_strings is None:
        long_strings = etree.SubElement(
            resources, f"{{{NSMAP['bt']}}}LongStrings", nsmap=NSMAP
        )

    # Add label (short string) with DefaultValue
    etree.SubElement(
        short_strings,
        f"{{{NSMAP['bt']}}}String",
        {"id": f"{button_id}.Label", "DefaultValue": label_text},
        nsmap=NSMAP_NO_ROOT,
    )

    # Add tooltip (long string) with DefaultValue
    etree.SubElement(
        long_strings,
        f"{{{NSMAP['bt']}}}String",
        {"id": f"{button_id}.Tooltip", "DefaultValue": tooltip_text},
        nsmap=NSMAP_NO_ROOT,
    )


def add_button_to_ribbon_group(
    tree, group_id, button_id, function_name, label_text, tooltip_text
):
    # Find group using xpath with namespace
    group_el = tree.find(f".//*[@id='{group_id}']")
    if group_el is None:
        return False

    # Resources
    add_resources_for_button(tree, button_id, label_text, tooltip_text)

    # Create button element
    new_button = etree.SubElement(
        group_el,
        f"{{{NSMAP['ov']}}}Control",
        {
            "{http://www.w3.org/2001/XMLSchema-instance}type": "Button",
            "id": button_id,
        },
    )

    # Add label
    etree.SubElement(
        new_button, f"{{{NSMAP['ov']}}}Label", {"resid": f"{button_id}.Label"}
    )

    # Add Supertip
    supertip = etree.SubElement(new_button, f"{{{NSMAP['ov']}}}Supertip")
    etree.SubElement(
        supertip, f"{{{NSMAP['ov']}}}Title", {"resid": f"{button_id}.Label"}
    )
    etree.SubElement(
        supertip, f"{{{NSMAP['ov']}}}Description", {"resid": f"{button_id}.Tooltip"}
    )

    # Add Icon with bt namespace
    icon = etree.SubElement(new_button, f"{{{NSMAP['ov']}}}Icon")
    for size in [16, 32, 80]:
        etree.SubElement(
            icon,
            f"{{{NSMAP['bt']}}}Image",
            {"size": str(size), "resid": f"Icon.{size}x{size}"},
            nsmap={"bt": NSMAP["bt"]},
        )

    # Add Action
    action = etree.SubElement(
        new_button,
        f"{{{NSMAP['ov']}}}Action",
        {"{http://www.w3.org/2001/XMLSchema-instance}type": "ExecuteFunction"},
    )
    etree.SubElement(action, f"{{{NSMAP['ov']}}}FunctionName").text = function_name

    return True


def move_button_in_group(tree, group_id, button_id, new_position):
    # Find the group
    group_el = tree.find(f".//*[@id='{group_id}']")
    if group_el is None:
        return False

    # Find the button within the group
    button = group_el.find(f".//*[@id='{button_id}']")
    if button is None:
        return False

    # Get all controls in the group
    controls = group_el.findall(f"{{{NSMAP['ov']}}}Control")
    if not controls:
        return False

    # Validate new position
    if new_position < 0 or new_position >= len(controls):
        return False

    # Remove button from current position
    group_el.remove(button)

    # Insert at new position
    group_el.insert(new_position, button)

    return True


# Usage example:

if __name__ == "__main__":
    p = Path(__file__).parent / "../templates/manifest.xml"

    parser = etree.XMLParser(
        remove_blank_text=True, remove_comments=False, strip_cdata=False
    )
    tree = etree.parse(str(p), parser)

    success = move_button_in_group(tree, "MyCommandsGroup", "MyFunctionButton2", 0)

    # success = add_button_to_ribbon_group(
    #     tree,
    #     "MyCommandsGroup",
    #     "MyFunctionButton2",
    #     "hello-ribbon2",
    #     "My Button",
    #     "Click this button to run the function",
    # )

    if success:
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
