var gaze = require( "../index.js" )
,   path = require( "path" )
;
gaze( "./deletion_assets/**/*", function( err, watcher ) {
    console.log( "ERROR", err );

    this.on( "changed", function( filepath ) {
        console.log( filepath, "was changed" );
    });

    this.on( "added", function( filepath ) {
        console.log( filepath, "was added" );
    });

    this.on( "deleted", function( filepath ) {
        console.log( filepath, "was deleted" );
    });

    this.on( "all", function( e, filepath ) {
        console.log( filepath, "was", e );
    });

    console.log( this.relative() );
});
