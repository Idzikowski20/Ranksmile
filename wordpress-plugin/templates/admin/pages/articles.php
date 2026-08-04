<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
use Ranksmile\Admin\RSDS\Health;
$count = Health::synced_article_count();
if ( $count < 1 ) :
?>
<div class="rs-empty">
	<h2 class="rs-empty__title"><?php esc_html_e( 'No synchronized articles', 'ranksmileseo' ); ?></h2>
	<p class="rs-empty__desc"><?php esc_html_e( 'Link posts from the Ranksmile editor or import content to see them here.', 'ranksmileseo' ); ?></p>
	<a class="rs-btn rs-btn--primary" href="<?php echo esc_url( admin_url( 'edit.php' ) ); ?>"><?php esc_html_e( 'Open posts', 'ranksmileseo' ); ?></a>
</div>
<?php else :
	$q = new WP_Query( array(
		'post_type'      => 'any',
		'posts_per_page' => 20,
		'meta_key'       => 'ranksmile_draft_id',
		'meta_compare'   => 'EXISTS',
	) );
	?>
	<div class="rs-card"><div class="rs-card__body">
		<table class="widefat striped" style="border:0;background:transparent;">
			<thead><tr>
				<th><?php esc_html_e( 'Title', 'ranksmileseo' ); ?></th>
				<th><?php esc_html_e( 'Draft ID', 'ranksmileseo' ); ?></th>
				<th><?php esc_html_e( 'Updated', 'ranksmileseo' ); ?></th>
			</tr></thead>
			<tbody>
			<?php while ( $q->have_posts() ) : $q->the_post(); ?>
				<tr>
					<td><a href="<?php echo esc_url( get_edit_post_link() ); ?>"><?php the_title(); ?></a></td>
					<td><?php echo esc_html( (string) get_post_meta( get_the_ID(), 'ranksmile_draft_id', true ) ); ?></td>
					<td><?php echo esc_html( get_the_modified_date() ); ?></td>
				</tr>
			<?php endwhile; wp_reset_postdata(); ?>
			</tbody>
		</table>
	</div></div>
<?php endif; ?>
