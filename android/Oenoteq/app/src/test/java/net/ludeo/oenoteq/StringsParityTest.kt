package net.ludeo.oenoteq

import org.junit.Assert.assertEquals
import org.junit.Test
import org.w3c.dom.Element
import java.io.File
import javax.xml.parsers.DocumentBuilderFactory

/** English and French declare the same strings, as the PWA's catalogParity test does for its catalogs. */
class StringsParityTest {
    private fun keys(locale: String): Set<String> {
        val file = File("src/main/res/$locale/strings.xml")
        val root = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(file).documentElement
        val children = root.childNodes
        return (0 until children.length)
            .map(children::item)
            .filterIsInstance<Element>()
            .filter { it.getAttribute("translatable") != "false" }
            .map { "${it.tagName}:${it.getAttribute("name")}" }
            .toSet()
    }

    @Test
    fun `French declares exactly the English strings`() {
        assertEquals(keys("values"), keys("values-fr"))
    }
}
