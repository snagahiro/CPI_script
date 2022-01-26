#include <pjsr/Sizer.jsh>
//#include <pjsr/NumericControl.jsh>

var cpiParameters = {
   coldSigma : 0,
   targetView: undefined
};


function CPI_dialog() {
   this.__base__ = Dialog;
   this.__base__();

   this.minWidth = 600;
   this.minHeight = 500;

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

   //numerical
   this.setAmount = new NumericControl(this);
   this.setAmount.label.text = "Cold sigma"
   this.setAmount.setRange(0,1);
   this.setAmount.setPrecision(2);
   this.setAmount.slider.setRange(0,100);
   this.setAmount.onValueUpdated = function(value) {
      cpiParameters.coldSigma = value;
      Console.writeln("new value: ",cpiParameters.coldSigma );
   }

   //size
   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.add( this.title );
   this.sizer.addSpacing(8);
   this.sizer.add( this.viewList );
   this.sizer.addSpacing(8);
   this.sizer.add( this.setAmount );
   this.sizer.addStretch();

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
