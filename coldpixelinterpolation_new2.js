
#include <pjsr/Sizer.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/ImageOp.jsh>

#define DEFAULT_OUTPUT_EXTENSION ".xisf"

//1:29:25

var cpiParameters = {
   coldSigma: 0,
   targetView: undefined
};

function ColdPixelInterpolationEngine() {
   /*maybe including parameters which is NOT necessary... */
   this.inputFiles = new Array;
   this.outputDirectory = "";
   this.outputPrefix = "";
   this.outputPostfix = "";
   this.outputExtension = DEFAULT_OUTPUT_EXTENSION;
   this.overwriteExisting = true;
   this.outputFormat = null;

   this.readImage = function (filePath) {
      var inputImageWindow = ImageWindow.open(filePath);

      return inputImageWindow[0];
   };

   this.writeImage = function (imageWindow, filePath) {
      var fileDir = (this.outputDirectory.length > 0) ? this.outputDirectory :
         File.extractDrive(filePath) + File.extractDirectory(filePath);
      if (!fileDir.endsWith('/'))
         fileDir += '/';
      var fileName = File.extractName(filePath);

      var outputFilePath = fileDir + this.outputPrefix + fileName + this.outputPostfix + this.outputExtension;
      console.writeln("<end><cbr><br>Output file:");

      if (File.exists(outputFilePath)) {
         if (this.overwriteExisting) {
            console.writeln("<end><cbr>** Overwriting existing file: " + outputFilePath);
         }
         else {
            console.writeln("<end><cbr>* File already exists: " + outputFilePath);
            for (var u = 1; ; ++u) {
               var tryFilePath = File.appendToName(outputFilePath, '_' + u.toString());
               if (!File.exists(tryFilePath)) {
                  outputFilePath = tryFilePath;
                  break;
               }
            }
            console.writeln("<end><cbr>* Writing to: <raw>" + outputFilePath + "</raw>");
         }
      }
      else {
         console.writeln("<raw>" + outputFilePath + "</raw>");
      }

      // write the output image to disk using
      // Boolean ImageWindow.saveAs(
      //    String filePath[,
      //    Boolean queryOptions[,
      //    Boolean allowMessages[,
      //    Boolean strict[,
      //    Boolean verifyOverwrite]]]] )
      imageWindow.saveAs(outputFilePath, false, false, false, false);
      // this statement will force ImageWindow to disable all format and security features, as follows
      //    disable query format-specific options
      //    disable warning messages on missing format features (icc profiles, etc)
      //    disable strict image writing mode (ignore lossy image generation)
      //    disable overwrite verification/protection

   };

   this.coldPixelInterpolationFiles = function () {
      var currentImage = null;
      var stackedImage = null;
      var directory = null;
      for (var i = 0; i < this.inputFiles.length; ++i) {
         currentImage = this.readImage(this.inputFiles[i]);
         if (i == 0) {
            directory = (this.outputDirectory.length > 0) ? this.outputDirectory :
               File.extractDrive(this.inputFiles[i]) + File.extractDirectory(this.inputFiles[i]);
         }
         if (stackedImage == null) {
            stackedImage = new Image(currentImage.mainView.image.width, currentImage.mainView.image.height);
         }
         currentImage.mainView.beginProcess();
         var image = currentImage.mainView.image;
         //stacking
         image.apply(this.inputFiles.length, ImageOp_Div); //divide current image
         stackedImage.apply(image, ImageOp_Add);           //and add!
         currentImage.mainView.endProcess();
      }

      //Convert to ImageWindow Object
      var stackedImageWin = new ImageWindow(stackedImage.width, stackedImage.height);
      stackedImageWin.mainView.beginProcess();
      stackedImageWin.mainView.image.assign(stackedImage);
      stackedImageWin.mainView.endProcess();

      stackedImagePath = directory + "/stacked.xisf";
      Console.writeln(stackedImagePath);

      //Output stacked imaged to input for CosmeticCorrection
      this.writeImage(stackedImageWin, stackedImagePath);

      //CC Process
      var cc_process = new CosmeticCorrection;
      with (cc_process) {
         targetFrames = [[true, stackedImagePath]];
         masterDarkPath = "";
         outputDir = "";
         outputExtension = ".xisf";
         prefix = "";
         postfix = "_cc";
         overwrite = false;
         cfa = true;
         useMasterDark = false;
         hotDarkCheck = false;
         hotDarkLevel = 1.0000000;
         coldDarkCheck = false;
         coldDarkLevel = 0.0000000;
         useAutoDetect = true;
         hotAutoCheck = false;
         hotAutoValue = 3.0;
         coldAutoCheck = true;
         coldAutoValue = cpiParameters.coldSigma;
         amount = 1.00;
         useDefectList = false;
         defects = [];
         executeGlobal();
      }

      //Read CC-ed image
      stackedImageCCPath = directory + "/stacked_cc.xisf";
      var stackedCCImageWin = this.readImage(stackedImageCCPath);

      //Create Cool File
      var coolImage = new ImageWindow(stackedCCImageWin);
      coolImage.mainView.beginProcess();
      coolImage.mainView.image.apply(stackedImageWin.mainView.image, ImageOp_Sub);
      coolImage.mainView.endProcess();

      //Apply Cool File to original light frames
      var directory = null;
      for (var i = 0; i < this.inputFiles.length; ++i) {
         currentImage = this.readImage(this.inputFiles[i]);
         if (i == 0) {
            directory = (this.outputDirectory.length > 0) ? this.outputDirectory :
               File.extractDrive(this.inputFiles[i]) + File.extractDirectory(this.inputFiles[i]);
            directory += "/corrected";
            if (!File.directoryExists(directory)) {
               File.createDirectory(directory);
            }
         }
         currentImage.mainView.beginProcess();
         var image = currentImage.mainView.image;
         image.apply(coolImage.mainView.image, ImageOp_Add);
         currentImage.mainView.endProcess();
         var fileName = File.extractName(this.inputFiles[i]);
         var outPath = directory + "/" + fileName;
         this.outputPostfix = "_cf";
         this.writeImage(currentImage, outPath);
      }

   }
}

var engine = new ColdPixelInterpolationEngine;


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
   this.files_TreeBox = new TreeBox(this);
   this.files_TreeBox.multipleSelection = true;
   this.files_TreeBox.rootDecoration = false;
   this.files_TreeBox.alternateRowColor = true;
   this.files_TreeBox.setScaledMinSize(300, 200);
   this.files_TreeBox.numberOfColumns = 1;
   this.files_TreeBox.headerVisible = false;

   for (var i = 0; i < engine.inputFiles.length; ++i) {
      var node = new TreeBoxNode(this.files_TreeBox);
      node.setText(0, engine.inputFiles[i]);
   }

   this.filesAdd_Button = new PushButton(this);
   this.filesAdd_Button.text = "Add";
   this.filesAdd_Button.icon = this.scaledResource(":/icons/add.png");
   this.filesAdd_Button.toolTip = "<p>Add image files to the input images list.</p>";
   this.filesAdd_Button.onClick = function () {
      var ofd = new OpenFileDialog;
      ofd.multipleSelections = true;
      ofd.caption = "Select Images";
      ofd.loadImageFilters();

      if (ofd.execute()) {
         this.dialog.files_TreeBox.canUpdate = false;
         for (var i = 0; i < ofd.fileNames.length; ++i) {
            var node = new TreeBoxNode(this.dialog.files_TreeBox);
            node.setText(0, ofd.fileNames[i]);
            engine.inputFiles.push(ofd.fileNames[i]);
         }
         this.dialog.files_TreeBox.canUpdate = true;
      }
   };

   //numerical
   this.setAmount = new NumericControl(this);
   this.setAmount.label.text = "Cold sigma"
   this.setAmount.setRange(0, 1);
   this.setAmount.setPrecision(2);
   this.setAmount.slider.setRange(0, 100);
   this.setAmount.onValueUpdated = function (value) {
      cpiParameters.coldSigma = value;
      Console.writeln("new value: ", cpiParameters.coldSigma);
   }

   //execute button
   this.execButton = new PushButton(this);
   this.execButton.text = "EXECUTE";
   this.execButton.width = 40;
   this.execButton.onClick = () => {
      engine.coldPixelInterpolationFiles();
      this.ok();
   }

   //add cread instance botton
   this.newInstanceButton = new ToolButton(this);
   this.newInstanceButton.icon = this.scaledResource(":/process-interface/new-instance.png");
   this.newInstanceButton.setScaledFixedSize(24, 24);

   this.bottomSizer = new HorizontalSizer;
   this.bottomSizer.margin = 8;
   this.bottomSizer.add(this.newInstanceButton);
   this.bottomSizer.addStretch();
   this.bottomSizer.add(this.execButton);


   //size
   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.add(this.title);
   //this.sizer.addSpacing(8);
   //this.sizer.add( this.viewList );
   this.sizer.addSpacing(8);
   this.sizer.add(this.setAmount);
   this.sizer.addSpacing(8);
   this.sizer.add(this.files_TreeBox);
   this.sizer.addSpacing(8);
   this.sizer.add(this.filesAdd_Button);
   this.sizer.addSpacing(8);
   this.sizer.add(this.bottomSizer);
   this.sizer.addStretch();

}

CPI_dialog.prototype = new Dialog;

function showDialog() {
   let dialog = new CPI_dialog;
   return dialog.execute();
}

function main() {
   let retVal = showDialog();

   if (retVal == 1) {
      //perform
      Console.writeln("test");
   } else {
      //canceled
   }


}

main();
