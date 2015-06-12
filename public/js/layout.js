function Pager(size) {
  this.page      = 0;
  this.length    = 0;
  this.page_size = (size === undefined) ? 0 : size;
}

Pager.prototype.move = function(dir) {
  // Pages left/right relative to current page
  //  @dir: direction to move (+ to move up, - to move down)
  //        if dir is undefined, will move to page 0
  if(dir === undefined) { this.page = 0; return; }
  this.page += dir;

  if(this.page <= 0) this.page = 0;
  if(this.page >= this.total()) this.page = this.total();
}

// Accessors
Pager.prototype.total = function() {
  // Return total number of pages possible
  try {
    // round down to multiple of page_size
    var actual_length = this.length - 1; // correct 1-off errors
    var mult = actual_length - (actual_length % this.page_size);
    // Divide by page size, then add 1
    return Math.floor(mult / this.page_size);

  } catch(err) {
    console.log(err); // Most likely divide by zero error
    return 0;
  }
}

Pager.prototype.first = function() {
  // Get number of item at start of current page
  return this.page * this.page_size;
}

Pager.prototype.last = function() {
  // Get number of item at end of current page
  if(this.length <= 0) return 0;

  // Return last item on page regardless if exists
  var last = (this.page * this.page_size) + this.page_size;

  // Add in check if last item reached before end of page
  return (last <= this.length) ? last - 1 : this.length - 1;
}
