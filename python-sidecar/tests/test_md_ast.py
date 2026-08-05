from pipeline.html_renderer import render_html
from pipeline.md_ast import parse_markdown


def test_markdown_flows_through_ast_to_safe_html():
    ast = parse_markdown("""## Plan

Text with **important** term and [safe](https://example.com).

- first
- second

| Name | Value |
| --- | --- |
| SEO | 10 |
""")

    assert [node.kind for node in ast.children] == ["heading", "paragraph", "list", "table"]
    assert render_html(ast) == (
        '<h2>Plan</h2><p>Text with <strong>important</strong> term and '
        '<a href="https://example.com">safe</a>.</p><ul><li>first</li><li>second</li></ul>'
        '<table><thead><tr><th>Name</th><th>Value</th></tr></thead>'
        '<tbody><tr><td>SEO</td><td>10</td></tr></tbody></table>'
    )


def test_renderer_escapes_writer_html_and_unsafe_links():
    html = render_html(parse_markdown('[bad](javascript:alert(1)) <script>alert(1)</script>'))

    assert 'javascript:' not in html
    assert '&lt;script&gt;' in html
