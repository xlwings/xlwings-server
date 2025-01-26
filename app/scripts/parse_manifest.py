from pathlib import Path

from lxml import etree

NAMESPACE_OV = "http://schemas.microsoft.com/office/taskpaneappversionoverrides"
NSMAP = {
    None: "http://schemas.microsoft.com/office/appforoffice/1.1",
    "bt": "http://schemas.microsoft.com/office/officeappbasictypes/1.0",
    "ov": "http://schemas.microsoft.com/office/taskpaneappversionoverrides",
    "xsi": "http://www.w3.org/2001/XMLSchema-instance",
}


def add_button_to_ribbon_group(tree, group_id, new_button_id):
    # Find group using xpath with namespace
    group_elem = tree.find(f".//*[@id='{group_id}']")
    if group_elem is None:
        return False

    # Create new button element
    new_button = etree.SubElement(
        group_elem,
        f"{{{NAMESPACE_OV}}}Control",
        {
            "{http://www.w3.org/2001/XMLSchema-instance}type": "Button",
            "id": new_button_id,
        },
    )
    # Add label
    etree.SubElement(
        new_button, f"{{{NAMESPACE_OV}}}Label", {"resid": f"{new_button_id}.Label"}
    )
    return True


if __name__ == "__main__":
    p = Path(__file__).parent / "../templates/manifest.xml"

    # Parse while preserving docinfo
    parser = etree.XMLParser(
        remove_blank_text=True, remove_comments=False, strip_cdata=False
    )
    tree = etree.parse(str(p), parser)

    success = add_button_to_ribbon_group(
        tree=tree, group_id="MyCommandsGroup", new_button_id="MyNewButton"
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
