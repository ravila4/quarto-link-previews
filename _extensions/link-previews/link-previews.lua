-- Injects the link-previews script/stylesheet and page config for HTML output.

local function spike_probe(m)
  -- SPIKE: check whether hover options are visible to the filter.
  for _, k in ipairs({ "footnotes-hover", "crossrefs-hover", "citations-hover" }) do
    print("link-previews spike: meta['" .. k .. "'] = " .. tostring(m[k]))
  end
end

function Meta(m)
  if not quarto.doc.is_format("html:js") then
    return
  end

  spike_probe(m)

  quarto.doc.add_html_dependency({
    name = "link-previews",
    version = "0.1.0",
    scripts = { { path = "link-previews.js", attribs = { type = "module" } } },
    stylesheets = { "link-previews.css" },
  })

  local cfg = {}
  local json = quarto.json.encode(cfg):gsub("</", "<\\/")
  quarto.doc.include_text("in-header",
    '<script type="application/json" id="link-previews-config">' .. json .. "</script>")
end
