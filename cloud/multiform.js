module.exports.parse = function(input) {
  // Parse a multipart/form string into an object
  //    @input: multipart/form string
  //    Returns: an object (undefined, if there is an error)

  var retval   = {};
  // Explode string into a temporary array
  var retarray = input.split("\r\n");

  var i = 0;
  while(i++ < retarray.length - 1) {
    // Content-Disposition specific to Multipart/form
    if(retarray[i].substring(0, 19) == "Content-Disposition") {
      // Generate new object's key
      // Extract name="value" -> value
      var objkey  = retarray[i].match(/.*?name="(.+?)"/)[1];
      var objfile = retarray[i].match(/.*?filename="(.+?)"/);
      if(objfile !== null ) { objfile = objfile[2]; }

      // Generate key's object
      var objval = "";
      var retsubstring = retarray[++i]; // Skip first newline
      do {
        objval += retarray[i];
        retsubstring = retarray[++i].substring(2, 0);
      } while(retsubstring != "--");

      retval[objkey] = objval;
    }
  }

  return retval;
};
