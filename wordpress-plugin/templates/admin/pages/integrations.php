<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
use Ranksmile\Admin\RSDS\Status;
$api = Status::for_api();
$gsc = Status::for_gsc();
?>
<section class="rs-grid rs-grid--3">
	<div class="rs-card"><div class="rs-card__header"><h2 class="rs-card__title">Ranksmile API</h2></div><div class="rs-card__body"><?php echo Status::render( $api['status'], $api ); ?></div></div>
	<div class="rs-card"><div class="rs-card__header"><h2 class="rs-card__title">Google Search Console</h2></div><div class="rs-card__body"><?php echo Status::render( $gsc['status'], $gsc ); ?></div></div>
	<div class="rs-card"><div class="rs-card__header"><h2 class="rs-card__title">Elementor</h2></div><div class="rs-card__body">
		<?php echo Status::render( Status::CONNECTED, array( 'title' => __( 'Elementor ready', 'ranksmileseo' ), 'description' => __( 'Export works when Elementor is active on a post.', 'ranksmileseo' ) ) ); ?>
	</div></div>
</section>
