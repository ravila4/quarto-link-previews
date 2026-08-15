-- Injects the link-previews script/stylesheet and page config for HTML output.
-- Config normalization only happens here; defaults live in link-previews.js
-- so there is a single, unit-tested source of truth.

local function to_plain(value)
  local lua_type = type(value)
  if lua_type == "boolean" or lua_type == "number" or lua_type == "string" then
    return value
  end
  if lua_type ~= "table" and lua_type ~= "userdata" then
    return value
  end
  local meta_type = pandoc.utils.type(value)
  if meta_type == "boolean" then
    return value
  elseif meta_type == "Inlines" or meta_type == "Blocks" or meta_type == "string" then
    return pandoc.utils.stringify(value)
  elseif meta_type == "List" then
    local out = {}
    for i, item in ipairs(value) do
      out[i] = to_plain(item)
    end
    return out
  elseif meta_type == "Meta" or meta_type == "table" then
    local out = {}
    for key, item in pairs(value) do
      out[key] = to_plain(item)
    end
    return out
  end
  return pandoc.utils.stringify(value)
end

local function as_table(value)
  if value == nil then
    return nil
  end
  local plain = to_plain(value)
  if type(plain) == "table" then
    return plain
  end
  return nil
end

-- Options are read from `link-previews:` at the metadata root and from
-- `extensions: link-previews:`. The nested spelling is the one editor
-- tooling completes against _schema.yml, so both have to work; nested keys
-- win where a key is set in both places.
local function read_config(m)
  local cfg = as_table(m["link-previews"]) or {}
  local extensions = as_table(m["extensions"])
  local nested = extensions and as_table(extensions["link-previews"])
  if nested then
    for key, value in pairs(nested) do
      cfg[key] = value
    end
  end
  return cfg
end

local function warn_if_tippy_absent(m)
  -- Quarto only ships tippy.js when at least one hover feature is on. The
  -- options are on by default and invisible here unless set explicitly, so an
  -- explicit triple-off is the only case worth warning about.
  if m["footnotes-hover"] == false
      and m["crossrefs-hover"] == false
      and m["citations-hover"] == false then
    quarto.log.warning(
      "link-previews: footnotes-hover, crossrefs-hover, and citations-hover are "
      .. "all disabled, so tippy.js will not load and link previews will be inactive.")
  end
end

function Meta(m)
  if not quarto.doc.is_format("html:js") then
    return
  end

  local cfg = read_config(m)
  if cfg.enabled == false then
    return
  end
  cfg.enabled = nil

  warn_if_tippy_absent(m)

  quarto.doc.add_html_dependency({
    name = "link-previews",
    version = "0.3.1",
    scripts = { { path = "link-previews.js", attribs = { type = "module" } } },
    stylesheets = { "link-previews.css" },
  })

  local json = quarto.json.encode(cfg):gsub("</", "<\\/")
  quarto.doc.include_text("in-header",
    '<script type="application/json" id="link-previews-config">' .. json .. "</script>")
end
