function getTemplate(flimit, fpage) {
  // Retrieves json object of all templates retrieved from server
  //    @limit: how many templates to retrieve
  //    @page:  page number to retrieve
  var retval = undefined;

  $.ajax(
    {
      url: "/action/getTemplates",
      method: "GET",
      data: {
        limit: flimit,
        page:  fpage
      },
      success: function(data, status) {
        retval = data;
        return retval;
      },
      error: function(jqXHR, status, err) {
        console.log("%s: %s", status, err);
        return retval;
      },
      statusCode: {
        406: function() {
          console.log("Server returned 'Not Acceptable'");
          return retval;
        }
      }
    }
  );
}

function templateMenu(jmenu, json) {
  // Populates div#template_menu
  //  @jmenu: jQuery object of <ul> to populate
  //  @json: json string or object of template objects
}

function templatePreview(jpreview, json) {
  // Populates div#template_preview
  //  @jmenu: jQuery object of <div> to populate
  //  @json: json string or object of currently selected template
}

$(document).ready(function() {
});
