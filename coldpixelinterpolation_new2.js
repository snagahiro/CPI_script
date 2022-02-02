
#include <pjsr/Sizer.jsh>

#include <pjsr/NumericControl.jsh>

//1:29:25

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
                     "&nbsp;a script removes cold pixels by apranat<br>" +
                     "now under construction!";
   this.title.readOnly = true;
   this.title.backgoundColor = 0x333333ff;
   this.title.minHeight = 120;
   this.title.maxHeight = 120;

   /*
   //show view list
   this.viewList = new ViewList(this);
   this.viewList.getMainViews();
   this.viewList.onViewSelected = function(view){
      cpiParameters.targetView = view ;
      Console.writeln("selected:", view.id );
   }*/

   //show file list
   this.files_TreeBox = new TreeBox( this );
   this.files_TreeBox.multipleSelection = true;
   this.files_TreeBox.rootDecoration = false;
   this.files_TreeBox.alternateRowColor = true;
   this.files_TreeBox.setScaledMinSize( 300, 200 );
   this.files_TreeBox.numberOfColumns = 1;
   this.files_TreeBox.headerVisible = false;

   for ( var i = 0; i < engine.inputFiles.length; ++i )
   {
      var node = new TreeBoxNode( this.files_TreeBox );
      node.setText( 0, engine.inputFiles[i] );
   }

   this.filesAdd_Button = new PushButton( this );
   this.filesAdd_Button.text = "Add";
   this.filesAdd_Button.icon = this.scaledResource( ":/icons/add.png" );
   this.filesAdd_Button.toolTip = "<p>Add image files to the input images list.</p>";
   this.filesAdd_Button.onClick = function()
   {
      var ofd = new OpenFileDialog;
      ofd.multipleSelections = true;
      ofd.caption = "Select Images";
      ofd.loadImageFilters();

      if ( ofd.execute() )
      {
         this.dialog.files_TreeBox.canUpdate = false;
         for ( var i = 0; i < ofd.fileNames.length; ++i )
         {
            var node = new TreeBoxNode( this.dialog.files_TreeBox );
            node.setText( 0, ofd.fileNames[i] );
            engine.inputFiles.push( ofd.fileNames[i] );
         }
         this.dialog.files_TreeBox.canUpdate = true;
      }
   };

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

   //execute button
   this.execButton = new PushButton(this);
   this.execButton.text = "EXECUTE";
   this.execButton.width = 40;
   this.execButton.onClick = () => {
      this.ok();
   }

   //add cread instance botton
   this.newInstanceButton = new ToolButton( this );
   this.newInstanceButton.icon = this.scaledResource(":/process-interface/new-instance.png");
   this.newInstanceButton.setScaledFixedSize(24,24);

   this.bottomSizer = new HorizontalSizer;
   this.bottomSizer.margin = 8;
   this.bottomSizer.add(this.newInstanceButton );
   this.bottomSizer.addStretch();
   this.bottomSizer.add(this.execButton);


   //size
   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.add( this.title );
   //this.sizer.addSpacing(8);
   //this.sizer.add( this.viewList );
   this.sizer.addSpacing(8);
   this.sizer.add( this.setAmount );
   this.sizer.addSpacing(8);
   this.sizer.add( this.files_TreeBox );
   this.sizer.addSpacing(8);
   this.sizer.add( this.filesAdd_Button );
   this.sizer.addSpacing(8);
   this.sizer.add( this.bottomSizer );
   this.sizer.addStretch();

}

CPI_dialog.prototype = new Dialog;

function showDialog() {
   let dialog = new CPI_dialog;
   return dialog.execute();
}

function main() {
      let retVal = showDialog();

      if(retVal == 1 ){
         //perform
         Console.writeln("test");
      }else{
         //canceled
      }


}

main();
