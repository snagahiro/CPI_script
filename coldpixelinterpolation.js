#include <pjsr/Sizer.jsh>

function CPI_dialog() {
   this.__base__ = Dialog;
   this.__base__();


   //title show
   this.title = new TextBox(this);
   this.title.text = "<b> Cold Pixel Interpolation v0.1</b><br><br>" +
                     "&nbsp;a script removes cold pixels by apranat";
   this.title.readOnly = true;
   this.title.backgoundColor = 0x333333ff;
   this.title.minHeight = 80;
   this.title.maxHeight = 80;

   //show view list
   this.viewList = new ViewList(this);
   this.viewList.getMainViews();

   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 8;
   this.sizer.add( this.title );
   this.sizer.add( this.viewList );

}

CPI_dialog.prototype = new Dialog;

function showDialog() {
   let dialog = new CPI_dialog;
   return dialog.execute();
}

function main() {
      let retVal = showDialog();
}

main();
