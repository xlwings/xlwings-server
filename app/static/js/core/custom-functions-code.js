async function hello(name) {
  let r = await window.hello(name);
  return r.toJs();
}

CustomFunctions.associate("HELLO", hello);
