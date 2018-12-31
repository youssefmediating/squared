export default `
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" {~namespace} android:name="{&name}" android:width="{&width}" android:height="{&height}" android:viewportWidth="{&viewportWidth}" android:viewportHeight="{&viewportHeight}" android:alpha="{~alpha}">
!1
	<group android:name="{&name}" android:rotation="{~rotation}" android:pivotX="{~pivotX}" android:pivotY="{~pivotY}" android:scaleX="{~scaleX}" android:scaleY="{~scaleY}" android:translateX="{~translateX}" android:translateY="{~translateY}">
!2
!clipPaths
		<clip-path android:name="{&name}" android:pathData="{&d}" />
!clipPaths
		<path android:name="{&name}" android:pathData="{&d}"
			android:fillColor="{~fill}" android:fillAlpha="{~fillOpacity}" android:fillType="{~fillRule}"
			android:strokeColor="{~stroke}" android:strokeAlpha="{~strokeOpacity}" android:strokeWidth="{~strokeWidth}"
			android:strokeLineCap="{~strokeLinecap}" android:strokeLineJoin="{~strokeLinejoin}" android:strokeMiterLimit="{~strokeMiterlimit}">
!fill
			<aapt:attr name="android:fillColor">
!gradients
				<gradient android:type="{&type}" android:startColor="@color/{~startColor}" android:endColor="@color/{~endColor}" android:centerColor="@color/{~centerColor}" android:startX="{~startX}" android:startY="{~startY}" android:endX="{~endX}" android:endY="{~endY}" android:centerX="{~centerX}" android:centerY="{~centerY}" android:gradientRadius="{~gradientRadius}">
!colorStop
					<item android:offset="{&offset}" android:color="{&color}" />
!colorStop
				</gradient>
!gradients
			</aapt:attr>
!fill
		</path>
!2
	</group>
!1
</vector>`;