$(document).ready(function() {
  // Template variables
  var templates = undefined;

  // jQuery elements
  var template_list     = undefined;
  var template_menu     = $("#template_menu");
  var template_preview  = $("#template_preview");

  var page_limit = 10; // How many items to display
  var page_curr  = 0;  // Current page
  getTemplates(page_limit, page_curr).then(
    function success(data, status) {
      templates = data;
      return templateMenu(template_menu, templates);
    },
    function error(jqXHR, status, err) {
      console.log("%s: %s", status, err);
    }
  ).then( //templateMenu() -> array of jQuery objects
    function success(retval) {
      // Bind click handlers to each object
      $.each(retval, function(i, value) {
        value.bind("click",
          function click(ev) {
            templatePreview(template_preview, templates[i]);
          }
        );
      });
    },
    function error(err) {
      console.log(err);
    }
  );
});
