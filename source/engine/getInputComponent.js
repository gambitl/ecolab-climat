import Input from 'Components/conversation/Input'
import Question from 'Components/conversation/Question'
import SelectAtmp from 'Components/conversation/select/SelectTauxRisque'
import { serialiseUnit } from 'Engine/units'
import { is, pick, prop, unless } from 'ramda'
import React, { Suspense } from 'react'
import {
	findRuleByDottedName,
	queryRule,
	disambiguateRuleReference,
	parentName,
} from './rules'
let SelectTwoAirports = React.lazy(() =>
	import('Components/conversation/select/SelectTwoAirports')
)
import SelectWeeklyDiet from 'Components/conversation/custom/SelectWeeklyDiet'
import SelectWeeklyTransport from 'Components/conversation/custom/SelectWeeklyTransport'

// This function takes the unknown rule and finds which React component should be displayed to get a user input through successive if statements
// That's not great, but we won't invest more time until we have more diverse input components and a better type system.

// eslint-disable-next-line react/display-name
export default (rules) => (dottedName) => {
	let rule = findRuleByDottedName(rules, dottedName)

	let commonProps = {
		key: dottedName,
		fieldName: dottedName,
		...pick(['dottedName', 'title', 'question', 'defaultValue'], rule),
	}
	if (rule.dottedName === 'transport . avion . distance de vol aller')
		return (
			<Suspense fallback={<div>Chargement des aéroports ...</div>}>
				<SelectTwoAirports {...{ ...commonProps }} />
			</Suspense>
		)

	const weeklyDietQuestion = (dottedName) =>
		dottedName.includes('alimentation . plats') &&
		dottedName.includes(' . nombre')
	if (weeklyDietQuestion(rule.dottedName))
		// This selected a precise set of questions to bypass their regular components and answer all of them in one big custom UI
		return (
			<SelectWeeklyDiet
				{...{
					...commonProps,
					question:
						'Choisissez les 5 plats de vos déjeuners pour une semaine type',
					dietRules: rules
						.filter((rule) => weeklyDietQuestion(rule.dottedName))
						.map((question) => [
							rules.find(
								({ dottedName }) =>
									dottedName === parentName(question.dottedName)
							),
							question,
						]),
				}}
			/>
		)

	const weeklyTransportQuestion = (dottedName) =>
		dottedName.includes('transport . moyens de transport') &&
		dottedName.includes(' . pourcent')
	if (weeklyTransportQuestion(rule.dottedName))
		// This selected a precise set of questions to bypass their regular components and answer all of them in one big custom UI
		return (
			<SelectWeeklyTransport
				{...{
					...commonProps,
					question:
						'Dans quelles proportions utilisez-vous ces moyens de transport pour vous rendre à Centrale ?',
					transportRules: rules
						.filter((rule) => weeklyTransportQuestion(rule.dottedName))
						.map((question) => [
							rules.find(
								({ dottedName }) =>
									dottedName === parentName(question.dottedName)
							),
							question,
						]),
				}}
			/>
		)

	if (getVariant(rule))
		return (
			<Question
				{...{
					...commonProps,
					choices: buildVariantTree(rules, dottedName),
				}}
			/>
		)
	if (rule.API) throw new Error("Le seul API implémenté est l'API géo")

	if (rule.suggestions == 'atmp-2017')
		return (
			<SelectAtmp
				{...{
					...commonProps,
					suggestions: rule.suggestions,
				}}
			/>
		)

	if (rule.unit == null && rule.defaultUnit == null)
		return (
			<Question
				{...{
					...commonProps,
					choices: [
						{ value: 'non', label: 'Non' },
						{ value: 'oui', label: 'Oui' },
					],
				}}
			/>
		)

	// Now the numeric input case

	return (
		<Input
			{...{
				...commonProps,
				unit: serialiseUnit(rule.unit || rule.defaultUnit),
				suggestions: rule.suggestions,
				inputEstimation:
					rule.inputEstimation &&
					findRuleByDottedName(
						rules,
						disambiguateRuleReference(rules, rule, rule.inputEstimation)
					),
			}}
		/>
	)
}

let getVariant = (rule) => queryRule(rule)('formule . une possibilité')

let buildVariantTree = (allRules, path) => {
	let rec = (path) => {
		let node = findRuleByDottedName(allRules, path)
		if (!node) throw new Error(`La règle ${path} est introuvable`)
		let variant = getVariant(node),
			variants = variant && unless(is(Array), prop('possibilités'))(variant),
			shouldBeExpanded = variant && true, //variants.find( v => relevantPaths.find(rp => contains(path + ' . ' + v)(rp) )),
			canGiveUp = variant && !variant['choix obligatoire']

		return Object.assign(
			node,
			shouldBeExpanded
				? {
						canGiveUp,
						children: variants.map((v) => rec(path + ' . ' + v)),
				  }
				: null
		)
	}
	return rec(path)
}
