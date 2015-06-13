function getTemplates(flimit, foffset) {
  // Retrieves json object of all templates retrieved from server
  //    @limit:  how many templates to retrieve
  //    @offset: item number to start retrieving from
  // Returns a jqXHR object
  var retval = undefined;

  return $.ajax(
    {
      url: "/action/getTemplates",
      method: "GET",
      data: {
        limit:  flimit,
        offset: foffset
      }
    }
  );
}

function templateMenu(jmenu, templates) {
  // Populates div#template_menu and return list of jQuery objects
  //  @jmenu: jQuery object of <ul> to populate
  //  @templates: array of template objects
  var promise = $.Deferred();
  var retval = [];

  try {
    if(jmenu === undefined || jmenu === undefined) {
      throw "Parameters undefined.";
    }

    // For each element in templates object, append to jmenu and add to retval
    $.each(templates, function(i, value) {
      var child = $("<li class=\"template_menu_li\">" + value.subject + "</li>");
      child.appendTo(jmenu);
      retval.push(child);
    });

    promise.resolve(retval);
    return promise;
  } catch(err) {
    promise.reject([err]);
    return promise;
  }
}

function templatePreview(jpreview, json) {
  // Populates div#template_preview
  //  @jmenu: jQuery object of <div> to populate
  //  @json: json object of currently selected template
  console.log(json);
  //jpreview.html(json.strippedHTML); // just throw it onto there... lol
}

$(document).ready(function() {
  // Template variables
  var templates = undefined;

  // jQuery elements
  var template_list     = undefined;
  var template_menu     = $("#template_menu");
  var template_preview  = $("#template_preview");

  var pager = undefined;
  var page_limit = 10; // How many items to display
  var page_curr  = 0;  // Current page
  getTemplates(page_limit, page_curr).then(
    function success(data, status) {
      templates = data;
      pager = new Pager(templates.length);
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
            template_preview.html(templates[i].strippedHTML);
          }
        );
      });
    },
    function error(err) {
      console.log(err);
    }
  );
});
