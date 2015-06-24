function cssSelectTemplate(jli, jform) {
  // Display template as selected
  var parent = jli.parent();
  parent.children(".select_template").toggleClass();
  jli.toggleClass("select_template");
  return jli;
}

function getSubClass(name, flimit, foffset) {
  // Retrieves json object of subclasses
  //    @name: name of get ajax route
  //    @limit:  how many records to retrieve
  //    @offset: item number to start retrieving from
  // Returns a jqXHR object
  return $.ajax(
    {
      url: "/actions/get" + name,
      method: "GET",
      data: {
        limit:  flimit,
        offset: foffset
      }
    }
  );
}

function applicantTable(jtable, applicants) {
  // Populates jtable and return list of jQuery objects
  //  @jtable: jQuery object of <table> to populate
  //  @applicants: array of applicant objects
  var promise = $.Deferred();
  var tbody  = jtable.children("tbody");
  var retval = [];

  try {
    if(jtable === undefined || applicants === undefined) {
      throw "Parameters undefined.";
    }

    // For each element in templates object, append to jtable and add to retval
    $.each(applicants, function(i, value) {
      var child = $("<tr>" +
                    "<td>" + value.lastname  + "</td>" +
                    "<td>" + value.firstname + "</td>" +
                    "<td>" + value.email + "</td>" +
                    "</tr>"
                   );
      child.appendTo(tbody);
      retval.push(child);
    });

    promise.resolve(retval);
    return promise;
  } catch(err) {
    promise.reject([err]);
    return promise;
  }
}

function templateMenu(jmenu, templates) {
  // Populates div#template_menu and return list of jQuery objects
  //  @jmenu: jQuery object of <ul> to populate
  //  @templates: array of template objects
  var promise = $.Deferred();
  var retval = [];

  try {
    if(jmenu === undefined || templates === undefined) {
      throw "Parameters undefined.";
    }

    // For each element in templates object, append to jmenu and add to retval
    $.each(templates, function(i, value) {
      var child = $("<li class=\"template_menu_li\">" + value.subject + "</li>");
      child.templateId = value.objectId;
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
  // Populates jpreview
  //  @jmenu: jQuery object of <div> to populate
  //  @json: json object of currently selected template

  // TODO: render editor controls
  jpreview.html(json.bodyHTML);
}
