<?php
/**
 *  Abstract class as boilerplate for all form elements classes.
 *
 * @package Ranksmile
 * @link https://ranksmile.pl
 */

namespace Ranksmile\Forms\Fields;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Boilerplate for all form elements classes.
 */
abstract class Ranksmile_Form_Element_Multichoice extends Ranksmile_Form_Element {

	/**
	 * Options in select.
	 *
	 * @var array
	 */
	protected $options = array();

	/**
	 * Add single option to field.
	 *
	 * @param mixed $value - value of the option.
	 * @param mixed $label - label of the option.
	 * @return void
	 */
	public function add_option( $value, $label ) {
		$this->options[] = array(
			'value' => strval( $value ),
			'label' => strval( $label ),
		);
	}

	/**
	 * Set array of the options.
	 *
	 * @param array $options - array of options.
	 * @return void
	 */
	public function set_options( $options ) {
		$this->options = $options;
	}

	/**
	 * Get array of the options.
	 *
	 * @return array
	 */
	public function get_options() {
		return $this->options;
	}
}
