from xlwings_server.build_utils import StaticFileHasher


def test_build_rewrites_only_complete_filenames(tmp_path):
    static = tmp_path / "static"
    module_dir = static / "js/wingman"
    module_dir.mkdir(parents=True)
    vendor = static / "vendor/wingman-reference"
    vendor.mkdir(parents=True)
    (vendor / "reference.json").write_text('{"schemaVersion":1,"chunks":[]}')
    (module_dir / "reference.js.map").write_text("{}")
    (module_dir / "reference.js").write_text(
        'const reference = "/static/vendor/wingman-reference/reference.json";\n'
        'const relative = "../../vendor/wingman-reference/reference.json";\n'
        "//# sourceMappingURL=reference.js.map\n"
    )
    (module_dir / "consumer.js").write_text(
        'import "./reference.js";\n'
        'import "./reference.js?version=1";\n'
        'import "./reference.js#fragment";\n'
    )
    (tmp_path / "taskpane.html").write_text(
        '<script src="/static/js/wingman/reference.js"></script>'
    )

    StaticFileHasher(static, tmp_path, build_id="testbuild").process_files()

    module = (module_dir / "reference.testbuild.js").read_text()
    assert '"/static/vendor/wingman-reference/reference.json"' in module
    assert '"../../vendor/wingman-reference/reference.json"' in module
    assert "sourceMappingURL=reference.js.map" in module
    assert (vendor / "reference.json").is_file()
    assert (module_dir / "reference.js.map").is_file()
    assert not (module_dir / "reference.js").exists()
    consumer = (module_dir / "consumer.testbuild.js").read_text()
    assert 'import "./reference.testbuild.js"' in consumer
    assert 'import "./reference.testbuild.js?version=1"' in consumer
    assert 'import "./reference.testbuild.js#fragment"' in consumer
    assert (
        '/static/js/wingman/reference.testbuild.js"'
        in (tmp_path / "taskpane.html").read_text()
    )
