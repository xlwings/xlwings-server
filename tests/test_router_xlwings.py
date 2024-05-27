from bs4 import BeautifulSoup
from fastapi.testclient import TestClient

from app.main import main_app

client = TestClient(main_app)


def test_get_alert():
    # String to the right of $_hostInfo added by Excel
    response = client.get(
        "xlwings/alert?prompt=Exception(%27test%27)&title=Error&buttons=ok&mode=critical&callback=&_host_Info=Excel$Mac$16.01$en-US$telemetry$isDialog$$0"
    )
    assert response.status_code == 200
    assert (
        '<button id="ok" type="button" class="btn btn-primary btn-xl-alert">OK</button>'
        in response.text
    )
    assert '<h1 class="pt-4">Error</h1>' in response.text
    assert "<p>Exception('test')</p>" in response.text

    # Check script tag
    soup = BeautifulSoup(response.text, "html.parser")
    script_tags = soup.find_all("script")
    script_tag = next(
        (tag for tag in script_tags if "xlwings-alert.js" in tag.get("src", "")), None
    )
    assert script_tag is not None
    script_response = client.get(script_tag["src"])
    assert script_response.status_code == 200


def test_custom_functions_meta():
    response = client.get("xlwings/custom-functions-meta")
    assert response.status_code == 200
    # print(repr(response.text))  # run via pytest -s
    assert (
        response.text
        == '{"allowCustomDataForDataTypeAny":true,"allowErrorForDataTypeAny":true,"functions":[{"description":"This is a normal custom function","id":"HELLO","name":"HELLO","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"name","dimensionality":"matrix","type":"any"}]},{"description":"In-Excel SQL\\n    see: https://docs.xlwings.org/en/latest/extensions.html#in-excel-sql","id":"SQL","name":"SQL","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"query","dimensionality":"matrix","type":"any"},{"description":"Positional argument 2","name":"tables","dimensionality":"matrix","type":"any","repeating":true}]},{"description":"This is a streaming function and must be provided as async generator","id":"STREAMING_RANDOM","name":"STREAMING_RANDOM","options":{"stream":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"rows","dimensionality":"matrix","type":"any"},{"description":"Positional argument 2","name":"cols","dimensionality":"matrix","type":"any"}]}]}'
    )


def test_custom_functions_code():
    response = client.get("xlwings/custom-functions-code")
    assert response.status_code == 200
    # print(repr(response.text))  # run via pytest -s
    assert (
        response.text
        == '/**\n * Required Notice: Copyright (C) Zoomer Analytics GmbH.\n *\n * xlwings PRO is dual-licensed under one of the following licenses:\n *\n * * PolyForm Noncommercial License 1.0.0 (for noncommercial use):\n *   https://polyformproject.org/licenses/noncommercial/1.0.0\n * * xlwings PRO License (for commercial use):\n *   https://github.com/xlwings/xlwings/blob/main/LICENSE_PRO.txt\n *\n * Commercial licenses can be purchased at https://www.xlwings.org\n */\n\nconst debug = false;\nlet invocations = new Set();\nlet bodies = new Set();\nlet runtime;\nlet contentLanguage;\n\nOffice.onReady(function (info) {\n  // Socket.io\n  const socket = globalThis.socket;\n\n  if (socket !== null) {\n    socket.on("disconnect", () => {\n      if (debug) {\n        console.log("disconnect");\n      }\n      for (let invocation of invocations) {\n        invocation.setResult([["Stream disconnected"]]);\n      }\n      invocations.clear();\n    });\n\n    socket.on("connect", () => {\n      // Without this, you\'d have to hit Ctrl+Alt+F9, which isn\'t available on the web\n      if (debug) {\n        console.log("connect");\n      }\n      for (let body of bodies) {\n        socket.emit("xlwings:function-call", body);\n      }\n    });\n  }\n\n  // Runtime version\n  if (\n    Office.context.requirements.isSetSupported("CustomFunctionsRuntime", "1.4")\n  ) {\n    runtime = "1.4";\n  } else if (\n    Office.context.requirements.isSetSupported("CustomFunctionsRuntime", "1.3")\n  ) {\n    runtime = "1.3";\n  } else if (\n    Office.context.requirements.isSetSupported("CustomFunctionsRuntime", "1.2")\n  ) {\n    runtime = "1.2";\n  } else {\n    runtime = "1.1";\n  }\n\n  // Content Language\n  contentLanguage = Office.context.contentLanguage;\n});\n\nasync function base() {\n  // Arguments\n  let argsArr = Array.prototype.slice.call(arguments);\n  let funcName = argsArr[0];\n  let isStreaming = argsArr[1];\n  let args = argsArr.slice(2, -1);\n  let invocation = argsArr[argsArr.length - 1];\n\n  // Body\n  let body = {\n    func_name: funcName,\n    args: args,\n    caller_address: invocation.address, // not available for streaming functions\n    content_language: contentLanguage,\n    version: "0.31.3",\n    runtime: runtime,\n  };\n\n  // Streaming functions communicate via socket.io\n  if (isStreaming) {\n    if (socket === null) {\n      console.error(\n        "To enable streaming functions, you need to load the socket.io js client before xlwings.min.js and custom-functions-code"\n      );\n      return;\n    }\n    let taskKey = `${funcName}_${args}`;\n    body.task_key = taskKey;\n    socket.emit("xlwings:function-call", body);\n    if (debug) {\n      console.log(`emit xlwings:function-call ${funcName}`);\n    }\n    invocation.setResult([["Waiting for stream..."]]);\n\n    socket.off(`xlwings:set-result-${taskKey}`);\n    socket.on(`xlwings:set-result-${taskKey}`, (data) => {\n      invocation.setResult(data.result);\n      if (debug) {\n        console.log(`Set Result`);\n      }\n    });\n\n    invocations.add(invocation);\n    bodies.add(body);\n\n    return;\n  }\n\n  // Normal functions communicate via REST API\n  let headers = {};\n  headers["Content-Type"] = "application/json";\n  headers["Authorization"] = await globalThis.getAuth();\n\n  let response = await fetch(\n    window.location.origin + "/xlwings/custom-functions-call",\n    {\n      method: "POST",\n      headers: headers,\n      body: JSON.stringify(body),\n    }\n  );\n  if (response.status !== 200) {\n    let errMsg = await response.text();\n    // Error message is only visible by hovering over the error flag!\n    if (\n      Office.context.requirements.isSetSupported(\n        "CustomFunctionsRuntime",\n        "1.2"\n      )\n    ) {\n      let error = new CustomFunctions.Error(\n        CustomFunctions.ErrorCode.invalidValue,\n        errMsg\n      );\n      throw error;\n    } else {\n      return [[errMsg]];\n    }\n  } else {\n    let responseData = await response.json();\n    return responseData.result;\n  }\n}\nasync function hello() {\n    let args = ["hello", false]\n    args.push.apply(args, arguments);\n    return await base.apply(null, args);\n}\nCustomFunctions.associate("HELLO", hello);\nasync function sql() {\n    let args = ["sql", false]\n    args.push.apply(args, arguments);\n    return await base.apply(null, args);\n}\nCustomFunctions.associate("SQL", sql);\nasync function streaming_random() {\n    let args = ["streaming_random", true]\n    args.push.apply(args, arguments);\n    return await base.apply(null, args);\n}\nCustomFunctions.associate("STREAMING_RANDOM", streaming_random);\n'
    )


def test_custom_functions_call():
    response = client.post(
        "/xlwings/custom-functions-call",
        json={
            "func_name": "hello",
            "args": [[["xlwings"]]],
            "caller_address": "Sheet1!B21",
            "content_language": "en-US",
            "version": "0.31.3",
            "runtime": "1.4",
        },
    )
    assert response.json() == {"result": [["Hello xlwings!"]]}
